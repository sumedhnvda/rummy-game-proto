"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { GameState } from "@/lib/game/types";
import { GameBoard } from "@/components/game/GameBoard";

export default function Home() {
  const socket = useSocket();
  const [name, setName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [queueStatus, setQueueStatus] = useState<{ size: number, current: number } | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.on("player-joined", (state: GameState) => {
      console.log("Player joined, updating state", state);
      setGameState(state);
      setQueueStatus(null); // Clear queue status if we join a game
    });

    socket.on("game-started", (state: GameState) => {
      setGameState(state);
    });

    socket.on("game-update", (state: GameState) => {
      setGameState(state);
    });

    socket.on("queue-joined", (status) => {
      setQueueStatus(status);
    });

    socket.on("error", (msg) => {
      setError(msg);
      setTimeout(() => setError(""), 3000);
    });

    return () => {
      socket.off("player-joined");
      socket.off("game-started");
      socket.off("queue-joined");
      socket.off("error");
    };
  }, [socket]);

  const createRoom = () => {
    if (!name) return alert("Enter name first");
    socket?.emit("create-room", { playerName: name, maxPlayers }, (newRoomId: string) => {
      setRoomId(newRoomId);
    });
  };

  const joinQueue = (size: number) => {
    if (!name) return alert("Enter name first");
    setQueueStatus({ size, current: 1 }); // optimistic
    socket?.emit("join-queue", { playerName: name, gameSize: size });
  };

  const joinRoom = () => {
    if (!name || !roomId) return alert("Enter name and room ID");
    socket?.emit("join-room", { roomId, playerName: name });
  };

  const startGame = () => {
    if (gameState) socket?.emit("start-game", gameState.roomId);
  }

  if (gameState && gameState.status === 'playing') {
    return <GameBoard socket={socket!} gameState={gameState} playerId={socket?.id || ""} />;
  }

  if (gameState) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white gap-6">
        <h1 className="text-3xl font-bold text-yellow-500">Room: {gameState.roomId}</h1>
        <span className="text-xs text-gray-400">Max Players: {gameState.maxPlayers}</span>

        <div className="bg-slate-800 p-6 rounded-lg w-96">
          <h3 className="text-xl mb-4 text-center">Players ({gameState.players.length}/{gameState.maxPlayers})</h3>
          <div className="space-y-2">
            {gameState.players.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-slate-700 p-3 rounded">
                <span>{p.name}</span>
                {p.id === socket?.id && <span className="text-xs text-green-400 font-bold">(YOU)</span>}
              </div>
            ))}
          </div>
        </div>

        {gameState.players.length >= 2 ? (
          <button onClick={startGame} className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-full font-bold text-xl shadow-lg transition-transform active:scale-95">
            START GAME
          </button>
        ) : (
          <p className="animate-pulse text-gray-400">Waiting for players...</p>
        )}
      </div>
    );
  }

  if (queueStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
        <div className="animate-spin text-4xl mb-4">⌛</div>
        <h2 className="text-2xl font-bold">Searching for {queueStatus.size} Player Game...</h2>
        <p className="text-gray-400">Current Queue: {queueStatus.current} waiting</p>
        <button onClick={() => window.location.reload()} className="mt-8 px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500/10">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 to-purple-900 text-white font-[family-name:var(--font-geist-sans)]">
      <h1 className="text-5xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
        Rummy Multiplayer
      </h1>

      {error && <div className="bg-red-500 p-3 rounded mb-4">{error}</div>}

      <div className="flex flex-col gap-6 w-full max-w-md px-4">
        <input
          className="p-4 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-center text-lg"
          placeholder="Enter Your Nickname"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        {/* Matchmaking Section */}
        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
          <h3 className="text-center text-yellow-400 font-bold mb-4 uppercase tracking-wider">Play Online</h3>
          <div className="grid grid-cols-3 gap-3">
            {[2, 3, 4, 5, 6].map(num => (
              <button
                key={num}
                onClick={() => joinQueue(num)}
                className="bg-blue-600/80 hover:bg-blue-500 p-3 rounded-lg font-bold flex flex-col items-center transition-all"
              >
                <span className="text-xl">{num}</span>
                <span className="text-[10px] uppercase opacity-70">Players</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="h-px bg-white/20 flex-1"></div>
          <span className="text-xs text-gray-400">OR</span>
          <div className="h-px bg-white/20 flex-1"></div>
        </div>

        {/* Private Room Section */}
        <div className="bg-white/5 p-6 rounded-xl border border-white/10">
          <h3 className="text-center text-green-400 font-bold mb-4 uppercase tracking-wider">Private Room</h3>

          <div className="flex items-center justify-between mb-4 bg-black/20 p-2 rounded-lg">
            <span className="text-sm text-gray-300 ml-2">Max Players:</span>
            <div className="flex gap-1">
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setMaxPlayers(n)}
                  className={`w-8 h-8 rounded text-xs font-bold ${maxPlayers === n ? 'bg-green-500 text-black' : 'bg-gray-700 text-gray-400'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button onClick={createRoom} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors mb-4">
            Create Private Room
          </button>

          <div className="flex gap-2">
            <input
              className="flex-1 p-3 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
            />
            <button onClick={joinRoom} className="bg-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-600 text-sm">
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
