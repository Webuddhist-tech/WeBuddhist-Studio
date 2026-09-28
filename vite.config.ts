import path from "path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

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
    plugins: [react(), tailwindcss()],
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
