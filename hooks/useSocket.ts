import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // In dev: undefined (connects to same origin localhost:3000)
        // In prod (Split): Vercel needs to point to Render URL
        // In prod (Unified): undefined (connects to same origin)
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

        const socketInstance = io(socketUrl, {
            path: "/socket.io", // Ensure path matches server default
            transports: ["websocket", "polling"], // Enforce websocket preferred
        });

        socketInstance.on("connect", () => {
            console.log("Connected to server:", socketInstance.id);
            setIsConnected(true);
        });

        socketInstance.on("disconnect", () => {
            console.log("Disconnected from server");
            setIsConnected(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return socket;
};
