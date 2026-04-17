import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var configDir = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    root: configDir,
    envDir: configDir,
    server: {
        host: "localhost",
        port: 5173,
        strictPort: true
    },
    plugins: [react()]
});
