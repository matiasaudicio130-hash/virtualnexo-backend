import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      // injectManifest permite usar un SW custom con push event handler
      strategies: "injectManifest",
      srcDir:     "src",
      filename:   "sw.ts",
      includeAssets: ["icons/*.png", "icons/*.svg"],
      manifest: {
        name: "AURA — Exclusive Lifestyle",
        short_name: "AURA",
        description: "La primera comunidad adulta con verificación de identidad real en Argentina. Verificación DNI y biometría. Fotos protegidas.",
        theme_color: "#C9A227",
        background_color: "#040409",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        // Copiar patrones del workbox anterior
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom", "react-router-dom"],
          "vendor-icons":  ["@phosphor-icons/react"],
          "vendor-query":  ["@tanstack/react-query"],
          "vendor-forms":  ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-ui":     ["gsap", "@gsap/react"],
          "page-feed":     ["./src/pages/Feed.tsx"],
          "page-explore":  ["./src/pages/Explore.tsx"],
          "page-messages": ["./src/pages/Messages.tsx"],
          "page-profile":  ["./src/pages/ProfileView.tsx"],
          "page-dashboard":["./src/pages/Dashboard.tsx"],
        },
      },
    },
    chunkSizeWarningLimit: 500,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn", "console.info"],
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
