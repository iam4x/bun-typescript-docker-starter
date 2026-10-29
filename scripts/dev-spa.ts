import { createServer as createViteServer } from "vite";

import { createServer } from "../src/server";

const backend = createServer({ port: 0 });
const frontend = await createViteServer({
  server: {
    host: "0.0.0.0",
    port: Number(process.env["PORT"] ?? 3000),
    strictPort: true,
    proxy: {
      "/api": { target: backend.url.origin },
      "/health": { target: backend.url.origin },
    },
  },
});

await frontend.listen();
frontend.printUrls();
