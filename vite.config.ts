/// <reference types="vitest/config" />
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Single-file builds (everything inlined into index.html) are OPT-IN via
// BUILD_SINGLEFILE=true — useful for kiosk/offline demos. The default build is
// code-split with stable vendor chunks so browsers cache the heavy libraries
// across deploys.
const singlefile = process.env.BUILD_SINGLEFILE === "true";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(singlefile ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: singlefile
    ? {}
    : {
        rollupOptions: {
          output: {
            manualChunks: {
              "vendor-react": ["react", "react-dom"],
              "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/functions"],
              "vendor-charts": ["recharts"],
              "vendor-motion": ["framer-motion"],
            },
          },
        },
      },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
