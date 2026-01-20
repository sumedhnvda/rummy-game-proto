import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { GameState, Card as CardType } from "@/lib/game/types";
import { Card } from "./Card";
import { HowToPlayModal } from "./HowToPlayModal";
import clsx from "clsx";

interface GameBoardProps {
    socket: Socket;
    gameState: GameState;
    playerId: string;
}

export const GameBoard = ({ socket, gameState, playerId }: GameBoardProps) => {
    const me = gameState.players.find(p => p.id === playerId);
    const opponents = gameState.players.filter(p => p.id !== playerId);
    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [actionError, setActionError] = useState("");
    const [winData, setWinData] = useState<{ winnerId: string, reason: string } | null>(null);

    useEffect(() => {
        socket.on("game-ended", (data) => {
            setWinData(data);
        });
        return () => { socket.off("game-ended"); };
    }, [socket]);

    const handleLeave = () => {
        if (confirm("Are you sure you want to leave? You will lose.")) {
            // Socket disconnect will handle specific logic, or we emit explicit "leave-room"
            // For now, simple disconnect simulation or reload
            window.location.reload();
        }
    };

    const handleDebugWin = () => {
        socket.emit("debug-win", gameState.roomId);
    };

    const toggleSelect = (cardId: string) => {
        if (selectedCards.includes(cardId)) {
            setSelectedCards(prev => prev.filter(c => c !== cardId));
        } else {
            setSelectedCards(prev => [...prev, cardId]);
        }
    };

    const handleDraw = (fromDiscard: boolean) => {
        if (!me?.isMyTurn) return;
        socket.emit("draw-card", { roomId: gameState.roomId, fromDiscard });
    };

    const handleDiscard = () => {
        if (!me?.isMyTurn) return;
        if (selectedCards.length !== 1) {
            setActionError("Select exactly 1 card to discard");
            setTimeout(() => setActionError(""), 2000);
            return;
        }
        socket.emit("discard-card", { roomId: gameState.roomId, cardId: selectedCards[0] });
        setSelectedCards([]);
    };

    if (!me) return <div>Loading...</div>;

    if (winData || gameState.status === 'ended') {
        const iWon = winData?.winnerId === me.id || gameState.winner === me.id;
        return (
            <div className="flex items-center justify-center min-h-screen bg-black text-white">
                <div className="text-center animate-bounce">
                    <h1 className={clsx("text-6xl font-black mb-4", iWon ? "text-yellow-400" : "text-red-600")}>
                        {iWon ? "YOU WON!" : "GAME OVER"}
                    </h1>
                    <p className="text-xl text-gray-400">{winData?.reason || "Game Ended"}</p>
                    <button onClick={() => window.location.reload()} className="mt-8 bg-white text-black px-6 py-2 rounded-full font-bold">
                        Back to Lobby
                    </button>
                </div>
            </div>
        );
    }

    const instruction = me.isMyTurn
        ? (me.hand.length === 14 ? "Select 1 card to DISCARD" : "DRAW a card from Deck or Discard Pile")
        : `Waiting for ${gameState.players.find(p => p.id === gameState.currentTurnPlayerId)?.name}...`;

    return (
        <div className="flex flex-col h-screen bg-green-800 p-4 text-white overflow-hidden relative">
            <HowToPlayModal />

            {actionError && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-2 rounded-full font-bold shadow-xl z-50 animate-bounce">
                    {actionError}
                </div>
            )}

            {/* Top Bar: Opponents */}
            <div className="flex justify-center gap-4 mb-4">
                {opponents.map(opp => (
                    <div key={opp.id} className={clsx("flex flex-col items-center p-2 rounded-lg transition-all", opp.isMyTurn ? "bg-yellow-500/20 scale-105 border border-yellow-400" : "bg-green-900/50")}>
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-black font-bold mb-1">
                            {opp.name[0]}
                        </div>
                        <div className="text-xs">{opp.name}</div>
                        <div className="text-xs text-yellow-300">Cards: {opp.hand.length}</div>
                        {opp.isMyTurn && <div className="text-xs text-green-300 animate-pulse font-bold">PLAYING...</div>}
                    </div>
                ))}
            </div>

            {/* Instruction Banner */}
            <div className="bg-black/30 p-2 text-center mb-8 rounded backdrop-blur">
                <span className={clsx("text-lg font-bold uppercase tracking-widest", me.isMyTurn ? "text-yellow-400" : "text-gray-400")}>
                    {instruction}
                </span>
            </div>

            {/* Top Buttons */}
            <div className="absolute top-4 left-4 flex gap-2">
                <button onClick={handleLeave} className="bg-red-900/50 hover:bg-red-900 text-xs px-3 py-1 rounded text-red-200 border border-red-700">
                    LEAVE GAME
                </button>
                <button onClick={handleDebugWin} className="bg-purple-900/50 hover:bg-purple-900 text-xs px-3 py-1 rounded text-purple-200 border border-purple-700">
                    DEBUG WIN
                </button>
            </div>

            {/* Center Table Area */}
            <div className="flex-1 flex items-center justify-center gap-16 relative">
                {/* Deck */}
                <div
                    className={clsx("flex flex-col items-center gap-2 group cursor-pointer transition-transform", me.isMyTurn && me.hand.length === 13 && "hover:scale-105 ring-4 ring-yellow-400/50 rounded-xl")}
                    onClick={() => handleDraw(false)}
                >
                    <div className="w-24 h-36 bg-blue-900 border-2 border-white rounded-lg shadow-xl flex items-center justify-center relative">
                        <div className="absolute inset-1 border border-blue-700/50 rounded pointer-events-none"></div>
                        <span className="font-bold text-xl select-none">DECK</span>
                    </div>
                    {me.isMyTurn && me.hand.length === 13 && <span className="text-xs bg-yellow-500 text-black px-2 rounded font-bold">CLICK TO DRAW</span>}
                </div>

                {/* Discard Pile */}
                <div
                    className={clsx("flex flex-col items-center gap-2 transition-transform cursor-pointer", me.isMyTurn && me.hand.length === 13 && gameState.discardPile.length > 0 && "hover:scale-105 ring-4 ring-red-400/50 rounded-xl")}
                    onClick={() => handleDraw(true)}
                >
                    <div className="w-24 h-36 border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center relative bg-white/5">
                        {gameState.discardPile.length > 0 ? (
                            <div className="transform rotate-0">
                                <Card
                                    card={gameState.discardPile[gameState.discardPile.length - 1]}
                                />
                            </div>
                        ) : (
                            <span className="text-white/30 text-xs">Empty</span>
                        )}
                    </div>
                    <span className="text-xs font-semibold tracking-widest text-white/70">DISCARD PILE</span>
                </div>
            </div>

            {/* Bottom: My Hand */}
            <div className="mt-auto">
                <div className="flex justify-center mb-6 gap-4">
                    <button className="px-6 py-2 bg-blue-600/80 rounded-full hover:bg-blue-600 text-sm font-bold border border-blue-400 transition-colors">Group Selected</button>
                    <button
                        onClick={handleDiscard}
                        disabled={!me.isMyTurn || selectedCards.length !== 1}
                        className={clsx(
                            "px-6 py-2 rounded-full text-sm font-bold border transition-colors flex items-center gap-2",
                            me.isMyTurn && selectedCards.length === 1
                                ? "bg-red-600 hover:bg-red-500 border-red-400 text-white shadow-lg shadow-red-900/50 scale-110"
                                : "bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed"
                        )}
                    >
                        DISCARD
                        {selectedCards.length === 1 && <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>}
                    </button>
                    <button className="px-6 py-2 bg-yellow-600/80 rounded-full hover:bg-yellow-600 text-sm font-bold border border-yellow-400 transition-colors">Declare</button>
                </div>

                <div className="relative h-48 flex justify-center items-end -space-x-8 pb-4 px-4 overflow-x-visible">
                    {me.hand.map((card, idx) => {
                        const isSelected = selectedCards.includes(card.id);
                        return (
                            <div
                                key={card.id}
                                style={{ zIndex: idx }}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", card.id);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault(); // Allow drop
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const draggedId = e.dataTransfer.getData("text/plain");
                                    if (draggedId === card.id) return;

                                    const newHand = [...me.hand];
                                    const fromIdx = newHand.findIndex(c => c.id === draggedId);
                                    const toIdx = newHand.findIndex(c => c.id === card.id);

                                    if (fromIdx !== -1 && toIdx !== -1) {
                                        const [movedItem] = newHand.splice(fromIdx, 1);
                                        newHand.splice(toIdx, 0, movedItem);

                                        // Update local state immediately to avoid flickers
                                        me.hand = newHand;

                                        socket.emit("rearrange-hand", {
                                            roomId: gameState.roomId,
                                            newOrderIds: newHand.map(c => c.id)
                                        });
                                    }
                                }}
                                className={clsx(
                                    "relative transition-all duration-200 cursor-grab active:cursor-grabbing",
                                    isSelected ? "-translate-y-6 z-50 scale-110" : "hover:-translate-y-4 hover:z-40"
                                )}
                            >
                                <Card
                                    card={card}
                                    selected={isSelected}
                                    onClick={() => toggleSelect(card.id)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Turn Indicator Main - Moved to top left/right corner to be less intrusive */}
            {me.isMyTurn && (
                <div className="absolute top-4 right-4 animate-bounce">
                    <div className="bg-yellow-500 text-black px-4 py-2 rounded-full font-bold shadow-lg border-2 border-white">
                        YOUR TURN
                    </div>
                </div>
            )}
        </div>
    );
};
