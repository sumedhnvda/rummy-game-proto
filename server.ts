import { config } from 'dotenv';
config();

import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import { RoomManager } from "./socket/roomManager";
import { connectDB } from "./lib/db";
import cors from "cors";

const hostname = "0.0.0.0"; // Bind to all interfaces for Render
const port = parseInt(process.env.PORT || "3000", 10);

const startServer = async () => {
    // Connect to MongoDB
    await connectDB();

    const app = express();
    app.use(cors());

    // Health check endpoint for Render
    app.get("/", (req, res) => {
        res.send("Rummy Socket Server Running");
    });

    const httpServer = createServer(app);

    const io = new Server(httpServer, {
        cors: {
            origin: "*", // Allow all connections (frontend needs to connect)
            methods: ["GET", "POST"]
        }
    });

    const roomManager = new RoomManager(io);

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("create-room", async ({ playerName, maxPlayers }, callback) => {
            const roomId = await roomManager.createRoom(maxPlayers);
            await roomManager.joinRoom(socket, roomId, playerName);
            if (callback) callback(roomId);
        });

        socket.on("join-queue", async ({ playerName, gameSize }) => {
            await roomManager.joinQueue(socket, playerName, gameSize);
        });

        socket.on("join-room", async ({ roomId, playerName }) => {
            await roomManager.joinRoom(socket, roomId, playerName);
        });

        socket.on("start-game", async (roomId) => {
            await roomManager.startGame(roomId);
        });

        socket.on("draw-card", async ({ roomId, fromDiscard }) => {
            await roomManager.drawCard(socket, roomId, fromDiscard);
        });

        socket.on("discard-card", async ({ roomId, cardId }) => {
            await roomManager.discardCard(socket, roomId, cardId);
        });

        socket.on("rearrange-hand", async ({ roomId, newOrderIds }) => {
            await roomManager.rearrangeHand(socket, roomId, newOrderIds);
        });

        socket.on("debug-win", async (roomId) => {
            await roomManager.debugWin(socket, roomId);
        });

        socket.on("disconnect", async () => {
            console.log("Client disconnected:", socket.id);
            await roomManager.handleDisconnect(socket);
        });
    });

    httpServer.listen(port, hostname, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
};

startServer().catch(err => {
    console.error(err);
    process.exit(1);
});
