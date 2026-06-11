import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Port/HMR settings follow the Tauri 2 template so `tauri dev` attaches cleanly.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  test: { environment: "node" },
});
