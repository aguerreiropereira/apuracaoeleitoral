/**
 * Servidor HTTP Node.js puro (sem dependências externas)
 * Oferece arquivos estáticos do frontend e endpoints REST / SSE da API de apuração.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const url = require("node:url");

const ElectionAggregator = require("./src/aggregator");
const CandidateService = require("./src/candidate-service");
const GeoService = require("./src/geo-service");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const aggregator = new ElectionAggregator();
aggregator.startBackgroundPoller();
const candidateService = new CandidateService(aggregator);
const geoService = new GeoService(aggregator);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- Rotas da API ---

  // 1. Endpoint REST do estado atual: /api/state
  if (pathname === "/api/state") {
    try {
      const snapshot = await aggregator.getSnapshot(parsedUrl.query);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      });
      res.end(JSON.stringify(snapshot));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 1b. Endpoint de Desempenho Detalhado do Candidato: /api/candidate-performance
  if (pathname === "/api/candidate-performance") {
    try {
      const data = await candidateService.getPerformance(parsedUrl.query);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 1c. Endpoint de Resumo Geográfico (Regiões e Estados): /api/geo-summary
  if (pathname === "/api/geo-summary") {
    try {
      const data = await geoService.getSummary(parsedUrl.query);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate"
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. Endpoint Server-Sent Events (SSE): /api/events
  if (pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });
    res.write("retry: 15000\n\n");
    aggregator.addSseClient(res, parsedUrl.query);
    return;
  }

  // 3. Health check: /api/health
  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }

  // --- Arquivos Estáticos ---
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  if (safePath === "/" || safePath === "\\") {
    safePath = "/index.html";
  } else if (safePath === "/mobile" || safePath === "/mobile/" || safePath === "/m") {
    safePath = "/mobile.html";
  }

  const filePath = path.join(PUBLIC_DIR, safePath);

  // Verifica se o arquivo existe dentro da pasta public
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: se não achar o arquivo, serve o index.html
      const indexPath = path.join(PUBLIC_DIR, "index.html");
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Erro interno ao ler arquivo.");
        return;
      }
      const headers = { "Content-Type": contentType };
      if (safePath === "/sw.js") {
        headers["Service-Worker-Allowed"] = "/";
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      }
      res.writeHead(200, headers);
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  Painel de Apuração Eleitoral Brasil rodando!`);
  console.log(`  Acesse no navegador: http://localhost:${PORT}`);
  console.log(`  Endpoint REST:        http://localhost:${PORT}/api/state`);
  console.log(`  Endpoint SSE:         http://localhost:${PORT}/api/events`);
  console.log(`======================================================\n`);
});
