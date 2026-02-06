import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  base: "/",
  build: {
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts", "lightweight-charts"],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
