import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

/**
 * Provides a shared Socket.IO connection.
 * Connects automatically when user is authenticated, disconnects on logout.
 */
export function SocketProvider({ children }) {
  const { user } = useAuth();
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
        autoConnect: false,
      }),
    []
  );

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    if (user) {
      socket.connect();
    } else {
      socket.disconnect();
      setIsConnected(false);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [socket, user]);

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

/**
 * Join and manage project room subscriptions for the lifetime of a component.
 * Automatically re-joins on reconnects and leaves on unmount/project change.
 */
export function useProjectRoom(projectIdOrIds) {
  const { socket, isConnected } = useSocket();
  const serialized = JSON.stringify(projectIdOrIds);

  useEffect(() => {
    if (!socket || !isConnected) return;
    const parsed = JSON.parse(serialized);
    const raw = Array.isArray(parsed) ? parsed : [parsed];
    const ids = raw.filter(Boolean);
    if (ids.length === 0) return;

    const payload = ids.length === 1 ? ids[0] : ids;
    socket.emit("room:join", payload);

    return () => {
      socket.emit("room:leave", payload);
    };
  }, [socket, isConnected, serialized]);
}

export default SocketContext;
