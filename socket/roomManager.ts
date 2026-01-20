import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { GameState, PlayerState, Card } from '../lib/game/types';
import { Deck } from '../lib/game/deck';
import { Redis } from '@upstash/redis';

// Use Environment Variables (Secure)
const redis = new Redis({
    url: process.env.REDIS_URL!,
    token: process.env.REDIS_TOKEN!,
});

interface RoomData {
    id: string;
    players: PlayerState[];
    gameState: GameState;
    deckState: { cards: Card[] };
}

export class RoomManager {
    private io: Server;
    // Using the global redis client instance

    constructor(io: Server) {
        this.io = io;
        console.log("Upstash Redis configured");
    }

    private async getRoom(roomId: string): Promise<{ room: RoomData, deck: Deck } | null> {
        // Upstash HTTP returns the object directly if we store it as JSON? 
        // No, Redis stores strings. Upstash SDK *can* auto-deserialize if you rely on it, but safe to treat as string or use `get<T>`.
        // Let's assume standard behavior: we stored string.
        const data = await redis.get<RoomData | string>(`room:${roomId}`);
        if (!data) return null;

        let roomData: RoomData;
        if (typeof data === 'string') {
            roomData = JSON.parse(data);
        } else {
            roomData = data; // Upstash might auto-parse JSON
        }

        const deck = Deck.fromState(roomData.deckState);
        return { room: roomData, deck };
    }

    private async saveRoom(room: RoomData, deck: Deck) {
        room.deckState = { cards: deck.cards };
        await redis.set(`room:${room.id}`, JSON.stringify(room), { ex: 86400 });
    }

    async createRoom(maxPlayers: number = 6): Promise<string> {
        const roomId = uuidv4().slice(0, 6).toUpperCase();
        const deck = new Deck(2, 2);
        deck.shuffle();

        const initialGameState: GameState = {
            roomId,
            players: [],
            currentTurnPlayerId: '',
            deckCount: deck.count,
            discardPile: [],
            status: 'waiting',
            maxPlayers
        };

        const roomData: RoomData = {
            id: roomId,
            players: [],
            gameState: initialGameState,
            deckState: { cards: deck.cards }
        };

        await this.saveRoom(roomData, deck);
        return roomId;
    }

    async joinQueue(socket: Socket, playerName: string, gameSize: number) {
        const queueKey = `queue:${gameSize}`;

        // Push to Redis List
        // Check if already in queue? Expensive scan. Just push and dedupe on pop.
        // Or use Set, but we need order.
        // Let's use simple List.

        const playerInfo = JSON.stringify({ id: socket.id, name: playerName });
        await redis.rpush(queueKey, playerInfo);
        // Track queue entry for cleanup on disconnect
        await redis.set(`queue_ref:${socket.id}`, JSON.stringify({ gameSize, playerInfo }), { ex: 3600 });
        console.log(`Player ${playerName} joined Redis queue ${gameSize}`);

        // Check length
        const len = await redis.llen(queueKey);

        if (len >= gameSize) {
            // Pop N players
            // Note: Race condition possible if multiple servers pop. 
            // Proper way: LPOP N with Lua script or simple loop if single threaded Node.
            // Since Node is single threaded for this process, `await` breaks atomicity? 
            // Redis operations are atomic, but the check-then-pop logic isn't if unrelated.
            // But `LPOP count` is atomic in Redis 6.2+.
            // Assuming simplified env.

            const playersRaw = await redis.lpop<string[]>(queueKey, gameSize);
            if (playersRaw && playersRaw.length === gameSize) {
                const players = playersRaw.map(s => (typeof s === 'string' ? JSON.parse(s) : s));

                // Remove queue refs for matched players so we don't try to remove them from queue on disconnect
                for (const p of players) {
                    await redis.del(`queue_ref:${p.id}`);
                }

                const roomId = await this.createRoom(gameSize);
                console.log(`Match managed via Upstash! Room ${roomId}`);

                for (const p of players) {
                    // We need to tell these sockets to join. 
                    // Problem: Socket objects are local to THIS server instance.
                    // If we are scaling, we need Pub/Sub.
                    // For now, assuming 1 server instance (Vertical Scaling) or Sticky Sessions.
                    // If using 1 instance, we can access via `this.io.sockets`.

                    const playerSocket = this.io.sockets.sockets.get(p.id);
                    if (playerSocket) {
                        await this.joinRoom(playerSocket, roomId, p.name);
                    }
                }
            }
        } else {
            socket.emit('queue-joined', { gameSize, current: len });
        }
    }

    async joinRoom(socket: Socket, roomId: string, playerName: string) {
        const data = await this.getRoom(roomId);
        if (!data) {
            socket.emit('error', 'Room not found');
            return;
        }
        const { room, deck } = data;

        if (room.players.find(p => p.id === socket.id)) {
            socket.join(roomId);
            socket.emit('player-joined', room.gameState);
            // Ensure mapping exists on reconnect
            await redis.set(`socket:${socket.id}`, roomId, { ex: 86400 });
            return;
        }

        if (room.players.length >= room.gameState.maxPlayers) {
            socket.emit('error', 'Room is full');
            return;
        }

        if (room.gameState.status !== 'waiting') {
            socket.emit('error', 'Game already started');
            return;
        }

        const newPlayer: PlayerState = {
            id: socket.id,
            name: playerName,
            hand: [],
            isMyTurn: false,
            hasDropped: false
        };

        room.players.push(newPlayer);
        room.gameState.players = room.players;

        // Save Room & Mapping
        await this.saveRoom(room, deck);
        await redis.set(`socket:${socket.id}`, roomId, { ex: 86400 });

        socket.join(roomId);
        this.io.to(roomId).emit('player-joined', room.gameState);
    }

    async startGame(roomId: string) {
        const data = await this.getRoom(roomId);
        if (!data) return;
        const { room, deck } = data;

        if (room.players.length < 2) return;

        room.gameState.status = 'playing';

        room.players.forEach(player => {
            player.hand = deck.deal(13);
            player.hand.sort((a, b) => a.suit.localeCompare(b.suit));
        });

        const openCard = deck.draw();
        if (openCard) room.gameState.discardPile.push(openCard);

        room.gameState.currentTurnPlayerId = room.players[0].id;
        room.players[0].isMyTurn = true;
        room.gameState.deckCount = deck.count;

        await this.saveRoom(room, deck);
        this.io.to(roomId).emit('game-started', room.gameState);
    }

    async drawCard(socket: Socket, roomId: string, fromDiscard: boolean) {
        const data = await this.getRoom(roomId);
        if (!data) return;
        const { room, deck } = data;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isMyTurn) return;
        if (player.hand.length >= 14) return;

        let card: Card | undefined;
        if (fromDiscard) {
            if (room.gameState.discardPile.length === 0) return;
            card = room.gameState.discardPile.pop();
        } else {
            card = deck.draw();
            // simple empty deck handle
            if (!card && room.gameState.discardPile.length > 0) {
                // Reshuffle logic (simplified: clear discard, warn user)
                socket.emit('error', 'Deck Empty - Game Over (Demo)');
                return;
            }
        }

        if (card) {
            player.hand.push(card);
            room.gameState.deckCount = deck.count;
            await this.saveRoom(room, deck);
            this.io.to(roomId).emit('game-update', room.gameState);
        }
    }

    async discardCard(socket: Socket, roomId: string, cardId: string) {
        const data = await this.getRoom(roomId);
        if (!data) return;
        const { room, deck } = data;

        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isMyTurn) return;
        if (player.hand.length !== 14) return;

        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const [discardedCard] = player.hand.splice(cardIndex, 1);
        room.gameState.discardPile.push(discardedCard);

        player.isMyTurn = false;
        const currentPlayerIndex = room.players.findIndex(p => p.id === player.id);
        const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
        room.players[nextPlayerIndex].isMyTurn = true;
        room.gameState.currentTurnPlayerId = room.players[nextPlayerIndex].id;

        await this.saveRoom(room, deck);
        this.io.to(roomId).emit('game-update', room.gameState);
    }

    async rearrangeHand(socket: Socket, roomId: string, newOrderIds: string[]) {
        const data = await this.getRoom(roomId);
        if (!data) return;
        const { room, deck } = data;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        const currentIds = new Set(player.hand.map(c => c.id));
        if (newOrderIds.length !== player.hand.length || !newOrderIds.every(id => currentIds.has(id))) return;

        const newHand: Card[] = [];
        const cardMap = new Map(player.hand.map(c => [c.id, c]));
        for (const id of newOrderIds) {
            const card = cardMap.get(id);
            if (card) newHand.push(card);
        }
        player.hand = newHand;

        await this.saveRoom(room, deck);
        // Ack not strictly needed but good for sync
        this.io.to(roomId).emit('game-update', room.gameState);
    }

    async debugWin(socket: Socket, roomId: string) {
        const data = await this.getRoom(roomId);
        if (!data) return;
        const { room, deck } = data;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        room.gameState.status = 'ended';
        room.gameState.winner = player.id;

        await this.saveRoom(room, deck);
        this.io.to(roomId).emit('game-ended', { winnerId: player.id, reason: 'Debug Win' });

        setTimeout(() => redis.del(`room:${roomId}`), 10000);
    }

    async handleDisconnect(socket: Socket) {
        // 1. Check if in Queue and remove
        const queueRefData = await redis.get<string>(`queue_ref:${socket.id}`);
        if (queueRefData) {
            const { gameSize, playerInfo } = JSON.parse(queueRefData);
            await redis.lrem(`queue:${gameSize}`, 0, playerInfo);
            await redis.del(`queue_ref:${socket.id}`);
            console.log(`Removed player from queue ${gameSize} due to disconnect`);
        }

        // 2. Check if in Room
        const roomId = await redis.get<string>(`socket:${socket.id}`);
        if (!roomId) return;

        await redis.del(`socket:${socket.id}`);

        const data = await this.getRoom(roomId);
        if (!data) return;
        const { room, deck } = data;

        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        const player = room.players[playerIndex];
        console.log(`Player ${player.name} disconnected from room ${roomId}`);

        if (room.gameState.status === 'playing') {
            if (room.players.length === 2) {
                const winner = room.players.find(p => p.id !== socket.id);
                if (winner) {
                    room.gameState.status = 'ended';
                    room.gameState.winner = winner.id;
                    this.io.to(roomId).emit('game-ended', { winnerId: winner.id, reason: 'Opponent Disconnected' });
                    await redis.expire(`room:${roomId}`, 300);
                }
            } else {
                room.players.splice(playerIndex, 1);

                if (player.isMyTurn && room.players.length > 0) {
                    const nextIdx = playerIndex >= room.players.length ? 0 : playerIndex;
                    room.players[nextIdx].isMyTurn = true;
                    room.gameState.currentTurnPlayerId = room.players[nextIdx].id;
                }

                await this.saveRoom(room, deck);
                this.io.to(roomId).emit('player-left', { playerId: socket.id, name: player.name, gameState: room.gameState });

                if (room.players.length === 1) {
                    const winner = room.players[0];
                    room.gameState.status = 'ended';
                    room.gameState.winner = winner.id;
                    this.io.to(roomId).emit('game-ended', { winnerId: winner.id, reason: 'All opponents left' });
                }
            }
        } else {
            room.players.splice(playerIndex, 1);
            await this.saveRoom(room, deck);
            this.io.to(roomId).emit('player-left', { playerId: socket.id, gameState: room.gameState });
        }
    }
}
