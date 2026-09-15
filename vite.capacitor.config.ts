import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist/mobile",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "capacitor.html",
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 3001,
  },
});
