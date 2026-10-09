import path from "path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  /**
   * Proxy target, with a fallback for an unset or empty variable.
   *
   * Vite quietly substitutes `base.invalid` for an empty target, so every
   * proxied request fails with an opaque DNS error rather than anything that
   * points at the missing configuration. Fall back to the documented default
   * and say so instead.
   */
  const target = (name: string, fallback: string): string => {
    const value = env[name]?.trim();
    if (value) return value;
    console.warn(
      `[vite] ${name} is not set; proxying to ${fallback}. ` +
        `Set it in .env to use a different service.`,
    );
    return fallback;
  };

  const libraryProxy = {
    "/library": {
      target: target("VITE_LIBRARY_BASE_URL", "https://library.webuddhist.com"),
      changeOrigin: true,
      secure: true,
      rewrite: (requestPath: string) => requestPath.replace(/^\/library/, ""),
      headers: {
        "X-Application": env.VITE_LIBRARY_APP_NAME?.trim() || "webuddhist",
      },
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Installable on phones and desktops. The service worker keeps the app
      // shell (HTML, JS, CSS, icons) so it opens fast and starts offline; data
      // always comes from the network. A new deploy waits for the author to
      // reload (PwaUpdatePrompt) rather than reloading under unsaved work.
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        includeAssets: ["apple-touch-icon-180x180.png", "pwa-64x64.png"],
        manifest: {
          id: "/",
          name: "WeBuddhist Studio",
          short_name: "Studio",
          description:
            "Create and manage WeBuddhist plans, practice spaces, events and community.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "any",
          // The default (dark) theme's background, so the splash screen and
          // the status bar match the app as it opens.
          background_color: "#161616",
          theme_color: "#161616",
          categories: ["productivity", "education"],
          icons: [
            { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,ico,webp,woff2}"],
          // The main bundle is over Workbox's 2 MB default.
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          navigateFallback: "/index.html",
          // The API, the library proxy and the live-control socket are
          // served by nginx, not the app shell.
          navigateFallbackDenylist: [/^\/api/, /^\/library/],
          runtimeCaching: [
            {
              // The large Tibetan fonts load when first needed, then stay.
              urlPattern: ({ request, url }) =>
                request.destination === "font" ||
                /\.(?:ttf|otf|woff)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "studio-fonts",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      open: true,
      // Keeps the library API behind our own origin, so its host never appears
      // in a browser request and the X-Application header is added server-side
      // rather than shipped in the bundle. In production nginx does this.
      proxy: libraryProxy,
    },
    // The same proxy for `vite preview`, so a built bundle behaves as the dev
    // server does.
    preview: { proxy: libraryProxy },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
      coverage: {
        provider: "istanbul",
        reporter: ["text", "json", "html"],
        reportsDirectory: "./coverage",
        exclude: [
          "src/components/ui/atoms/**",
          "src/components/ui/molecules/**",
          "**/*.ts",
          "**/*.js",
          "src/providers/**",
          "src/config/**",
          "src/utils/**",
          "src/assets/**",
          "src/App.tsx",
          "src/main.tsx",
        ],
      },
    },
  };
});
