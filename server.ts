import { config } from 'dotenv';
config();

import express, { Request, Response } from "express";
import next from "next";
import { Server } from "socket.io";
import { createServer } from "http";
import { parse } from "url";
import { RoomManager } from "./socket/roomManager";
import { connectDB } from "./lib/db";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    // Connect to MongoDB
    await connectDB();

    const server = express();
    const httpServer = createServer(server);

    const io = new Server(httpServer, {
        cors: {
            origin: "*", // Allow all for now, lock down in prod if Vercel URL known
            methods: ["GET", "POST"]
        }
    });

    const roomManager = new RoomManager(io);

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        socket.on("create-room", async ({ playerName, maxPlayers }, callback) => {
            const roomId = await roomManager.createRoom(maxPlayers);
            await roomManager.joinRoom(socket, roomId, playerName);
            callback(roomId);
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

    // Use middleware to handle all requests
    server.use((req: Request, res: Response) => {
        return handle(req, res);
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
