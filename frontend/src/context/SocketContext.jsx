import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

/**
 * Provides a shared Socket.IO connection.
 * Realtime board/task events will be subscribed to here once
 * the board features are built.
 */
export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);

  const socket = useMemo(
    () =>
      // Same-origin by default (Vite proxies /socket.io in dev) so the
      // HTTP-only auth cookies are sent with the handshake. Set
      // VITE_SOCKET_URL to override (e.g. a separate realtime domain).
      io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        autoConnect: true,
      }),
    []
  );

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.connect(); // needed for React 19 StrictMode double-mount in dev
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within a <SocketProvider>");
  return ctx;
}

export default SocketContext;
