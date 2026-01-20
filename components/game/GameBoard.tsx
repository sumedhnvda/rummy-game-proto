import { useEffect, useState, useRef } from "react";
import { Socket } from "socket.io-client";
import { GameState, Card as CardType } from "@/lib/game/types";
import { Card } from "./Card";
import { HowToPlayModal } from "./HowToPlayModal";
import clsx from "clsx";
import { motion, AnimatePresence } from "framer-motion";

interface GameBoardProps {
    socket: Socket;
    gameState: GameState;
    playerId: string;
}

export const GameBoard = ({ socket, gameState, playerId }: GameBoardProps) => {
    const me = gameState.players.find(p => p.id === playerId);
    const opponents = gameState.players.filter(p => p.id !== playerId);

    // Local Hand State for Fluid Dragging
    const [localHand, setLocalHand] = useState<CardType[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const [selectedCards, setSelectedCards] = useState<string[]>([]);
    const [actionError, setActionError] = useState("");
    const [winData, setWinData] = useState<{ winnerId: string, reason: string } | null>(null);

    // Animation State
    const [drawnCard, setDrawnCard] = useState<CardType | null>(null);
    const [showDrawAnim, setShowDrawAnim] = useState(false);
    const [isRevealing, setIsRevealing] = useState(false);
    // FIX: Initialize with current hand length to prevent animation on first render
    const prevHandLength = useRef<number>(me ? me.hand.length : 0);

    // Sync local hand with game state strictly when not dragging
    useEffect(() => {
        if (!me) return;

        if (!isDragging) {
            setLocalHand(me.hand);
        }

        // Detect Draw for Animation (Optimistic Reveal)
        if (me.hand.length > prevHandLength.current && me.isMyTurn) {
            const newCard = me.hand[me.hand.length - 1]; // Assume appended

            // If we already started animation (from click)
            if (showDrawAnim) {
                // Case 1: Mystery Card (Deck) - Wait, Reveal, then Close
                if (!drawnCard && newCard) {
                    setTimeout(() => {
                        setDrawnCard(newCard); // Reveal
                        setIsRevealing(true);
                        // Auto-hide animation after delay
                        setTimeout(() => {
                            setShowDrawAnim(false);
                            setDrawnCard(null);
                            setIsRevealing(false);
                        }, 1500);
                    }, 500);
                }
                // Case 2: Known Card (Discard) - Just Close after delay
                else {
                    setTimeout(() => {
                        setShowDrawAnim(false);
                        setDrawnCard(null);
                        setIsRevealing(false);
                    }, 1500);
                }
            }
            // Case 3: Passive/Fallback (Animation missed or not triggered by click)
            else if (!showDrawAnim) {
                const oldIds = new Set(localHand.map(c => c.id));
                const foundCard = me.hand.find(c => !oldIds.has(c.id));
                if (foundCard) {
                    setDrawnCard(foundCard);
                    setShowDrawAnim(true);
                    setTimeout(() => {
                        setShowDrawAnim(false);
                        setDrawnCard(null);
                    }, 2000);
                }
            }
        }
        prevHandLength.current = me.hand.length;
    }, [gameState, me?.hand, isDragging]);

    useEffect(() => {
        socket.on("game-ended", (data) => {
            setWinData(data);
        });
        return () => { socket.off("game-ended"); };
    }, [socket]);

    const handleLeave = () => {
        if (confirm("Are you sure you want to leave? You will lose.")) {
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

        // Optimistic Animation
        if (fromDiscard && gameState.discardPile.length > 0) {
            setDrawnCard(gameState.discardPile[gameState.discardPile.length - 1]);
            setIsRevealing(true);
        } else {
            setDrawnCard(null); // Unknown -> Back
            setIsRevealing(false);
        }
        setShowDrawAnim(true);

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

    // --- Drag & Drop Logic ---
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleDragStart = (e: React.DragEvent, position: number, cardId: string) => {
        dragItem.current = position;
        setIsDragging(true);
        e.dataTransfer.setData("text/plain", cardId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragEnter = (e: React.DragEvent, position: number) => {
        dragOverItem.current = position;

        if (dragItem.current !== null && dragItem.current !== dragOverItem.current) {
            const newHand = [...localHand];
            const draggedContent = newHand[dragItem.current];
            newHand.splice(dragItem.current, 1);
            newHand.splice(dragOverItem.current, 0, draggedContent);

            dragItem.current = dragOverItem.current; // Update drag index to new spot
            setLocalHand(newHand);
        }
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        dragItem.current = null;
        dragOverItem.current = null;

        // Emit new order to server
        if (me) {
            socket.emit("rearrange-hand", {
                roomId: gameState.roomId,
                newOrderIds: localHand.map(c => c.id)
            });
        }
    };


    if (!me) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
                <div className="text-center animate-pulse">
                    <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-2xl font-bold mb-2">Connecting to Game...</h2>
                    <p className="text-gray-400 mb-8 max-w-md">
                        We are syncing your game state. If this takes too long, your session might have expired.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full font-bold transition-transform active:scale-95"
                    >
                        Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

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

            <AnimatePresence>
                {showDrawAnim && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: -200 }}
                        animate={{ opacity: 1, scale: 1.5, y: 0, rotateY: isRevealing ? 360 : 0 }}
                        exit={{ opacity: 0, scale: 0.2, y: 400, transition: { duration: 0.5 } }}
                        transition={{ duration: 0.8, type: "spring" }}
                        className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
                    >
                        <div className="flex flex-col items-center gap-4">
                            <motion.div
                                className="shadow-2xl shadow-yellow-500/50 rounded-xl"
                                initial={{ rotateY: 0 }}
                                animate={{ rotateY: isRevealing ? 360 : 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                <div className="transform scale-150">
                                    {drawnCard ? (
                                        <Card card={drawnCard} />
                                    ) : (
                                        <div className="w-16 h-24 bg-blue-900 border-2 border-white rounded-lg shadow-xl flex items-center justify-center relative">
                                            <div className="absolute inset-1 border border-blue-700/50 rounded pointer-events-none"></div>
                                            <span className="font-bold text-xs text-white/50 select-none">RUMMY</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                            <span className="text-4xl font-black text-yellow-400 drop-shadow-lg bg-black/50 px-4 py-2 rounded">
                                {drawnCard ? "DRAWN!" : "DRAWING..."}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                <motion.div
                    whileHover={me.isMyTurn && me.hand.length === 13 ? { scale: 1.1 } : {}}
                    whileTap={me.isMyTurn && me.hand.length === 13 ? { scale: 0.95 } : {}}
                    className={clsx("flex flex-col items-center gap-2 group cursor-pointer", me.isMyTurn && me.hand.length === 13 && "ring-4 ring-yellow-400/50 rounded-xl")}
                    onClick={() => handleDraw(false)}
                >
                    <div className="w-24 h-36 bg-blue-900 border-2 border-white rounded-lg shadow-xl flex items-center justify-center relative">
                        <div className="absolute inset-1 border border-blue-700/50 rounded pointer-events-none"></div>
                        <span className="font-bold text-xl select-none">DECK</span>
                    </div>
                    {me.isMyTurn && me.hand.length === 13 && <span className="text-xs bg-yellow-500 text-black px-2 rounded font-bold">CLICK TO DRAW</span>}
                </motion.div>

                {/* Discard Pile */}
                <motion.div
                    whileHover={me.isMyTurn && me.hand.length === 13 && gameState.discardPile.length > 0 ? { scale: 1.1 } : {}}
                    whileTap={me.isMyTurn && me.hand.length === 13 && gameState.discardPile.length > 0 ? { scale: 0.95 } : {}}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = "yellow"; // Basic visual feedback
                    }}
                    onDragLeave={(e) => {
                        e.currentTarget.style.borderColor = "white";
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = "white";
                        const cardId = e.dataTransfer.getData("text/plain");
                        if (cardId && me.isMyTurn) {
                            // If player drops a card here, they want to DISCARD it
                            // Logic: emit discard
                            socket.emit("discard-card", { roomId: gameState.roomId, cardId });
                            setSelectedCards([]); // Clear selection
                        }
                    }}
                    className={clsx("flex flex-col items-center gap-2 cursor-pointer transition-colors", me.isMyTurn && me.hand.length === 13 && gameState.discardPile.length > 0 && "ring-4 ring-red-400/50 rounded-xl")}
                    onClick={() => handleDraw(true)}
                >
                    <div className="w-24 h-36 border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center relative bg-white/5 pointer-events-none">
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
                    <span className="text-[10px] text-yellow-400/70 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        DROP HERE TO DISCARD
                    </span>
                </motion.div>
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
                    <AnimatePresence initial={false}>
                        {localHand.map((card, idx) => {
                            const isSelected = selectedCards.includes(card.id);
                            return (
                                <motion.div
                                    layout
                                    key={card.id}
                                    style={{ zIndex: idx }}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e as any, idx, card.id)}
                                    onDragEnter={(e) => handleDragEnter(e as any, idx)}
                                    onDragEnd={handleDragEnd}
                                    onDragOver={(e) => e.preventDefault()}
                                    className={clsx(
                                        "relative cursor-grab active:cursor-grabbing",
                                        isSelected ? "z-50" : "hover:z-40"
                                    )}
                                    animate={{
                                        y: isSelected ? -24 : 0,
                                        scale: isSelected ? 1.1 : 1,
                                    }}
                                    whileHover={{ y: isSelected ? -24 : -16 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                >
                                    <Card
                                        card={card}
                                        selected={isSelected}
                                        onClick={() => toggleSelect(card.id)}
                                    />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Turn Indicator Main */}
            {me.isMyTurn && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-4 right-4"
                >
                    <div className="bg-yellow-500 text-black px-4 py-2 rounded-full font-bold shadow-lg border-2 border-white animate-pulse">
                        YOUR TURN
                    </div>
                </motion.div>
            )}
        </div>
    );
};
