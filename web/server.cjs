// CommonJS entry: Hostinger loads the startup file with require(), may pass PORT
// as a socket path, and requires listen() within 3 seconds, so Next.js is prepared after listening.
const { createServer } = require("node:http");
const next = require("next");

const rawPort = process.env.PORT || "3000";
const port = /^\d+$/.test(rawPort) ? Number(rawPort) : rawPort;
const app = next({ dev: false, dir: __dirname });
const ready = app.prepare().then(() => app.getRequestHandler());
ready.catch(error => {
  console.error(error);
  process.exit(1);
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (/^\/games\/[^/]+\/$/.test(url.pathname)) {
    response.writeHead(308, { Location: `${url.pathname}index.html${url.search}` });
    response.end();
    return;
  }
  const handle = await ready;
  void handle(request, response);
});
// Co-op WebSocket (/mp). Loaded lazily so a failure here never blocks the site.
import("./lib/server/multiplayer-ws.mjs").then(m => m.attachMultiplayer(server)).catch(error => console.error("[labs] multiplayer disabled:", error?.code || error?.name || "UNKNOWN"));
server.listen(port, () => console.log(`Vale dos Blocos disponível em ${port}`));
