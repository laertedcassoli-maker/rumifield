import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt"],
      manifest: {
        name: "RumiField",
        short_name: "RumiField",
        description: "Sistema de gestão de campo para técnicos",
        theme_color: "#16a34a",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          // 1) Auth — never cache
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
          },
          // 2) Storage (files/images) — long CacheFirst
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 3) Reference tables (rarely change) — CacheFirst 24h
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(clientes|pecas|produtos_quimicos|ticket_categories|ticket_tags|checklist_templates|preventive_checklist_template_items|profiles|user_roles|motor_templates|warranty_templates).*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-reference-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 4) Active preventives — fast NetworkFirst (1.5s timeout)
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/(preventive_checklists|preventive_checklist_items|preventive_route_items).*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-live-cache",
              networkTimeoutSeconds: 1.5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 2, // 2h
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 5) Rest of /rest/v1/ (transactional data) — NetworkFirst 3s
          // Tickets, orders, visits, work orders, CRM, etc.
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-data-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60, // 1h (offline fallback)
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // 6) Catch-all Supabase — NetworkFirst 3s
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-misc-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
