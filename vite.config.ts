import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The static portfolio lives at index.html (served as-is). This Vite app is the
// shadcn/React surface — its entry is app.html so it never clobbers index.html.
// "@" resolves to the repo root so "@/components/ui/..." matches the shadcn CLI.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    outDir: "dist-app",
    rollupOptions: {
      input: path.resolve(__dirname, "app.html"),
    },
  },
})
