import { fileURLToPath } from "node:url";

import tailwind from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  root: fileURLToPath(new URL("./client", import.meta.url)),
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    solid(),
    tailwind(),
    {
      name: "missing-assets",
      configureServer(server) {
        return () => {
          server.middlewares.use((request, response, next) => {
            const pathname = new URL(
              request.originalUrl ?? request.url ?? "/",
              "http://localhost",
            ).pathname;
            if (pathname === "/assets" || pathname.startsWith("/assets/")) {
              response.statusCode = 404;
              response.end("Not Found");
              return;
            }
            next();
          });
        };
      },
    },
  ],
  envPrefix: "PUBLIC_",
  build: {
    outDir: fileURLToPath(new URL("./dist/client", import.meta.url)),
    emptyOutDir: true,
  },
});
