import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_PROXY_TARGET || "http://localhost:4000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      strictPort: false,
      open: false,
      proxy: {
        // Frontend calls /api/* -> Express API (no CORS needed in dev)
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        // Socket.IO upgrade requests -> Express/Socket.IO server
        "/socket.io": {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
        // Uploaded task attachments (GET-only, served by Express)
        "/uploads": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
    },
  };
});
