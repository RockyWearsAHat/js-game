import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    },
    outDir: "./dist", // Output directly to dist in project root
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    fs: {
      // Allow serving files from one level up (project root)
      allow: [".."],
    },
  },
  resolve: {
    alias: {
      "@": resolve(process.cwd(), "./src"),
    },
  },
});
