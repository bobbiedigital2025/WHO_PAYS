const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const app = express();
const port = Number(process.env.PORT || 4173);

const requests = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 300;

app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));
app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const row = requests.get(ip) || { count: 0, start: now };

  if (now - row.start > RATE_WINDOW_MS) {
    row.count = 0;
    row.start = now;
  }

  row.count += 1;
  requests.set(ip, row);

  if (row.count > RATE_LIMIT) {
    return res.status(429).json({ error: "Too many requests" });
  }
  return next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  })
);
app.use(morgan("combined"));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});



app.get("/api/mcp/discover", async (_req, res) => {
  const mcpServer = process.env.BODIGI_MCP_SERVER;
  const mcpApiKey = process.env.BODIGI_MCP_API_KEY;

  if (!mcpServer) {
    return res.status(503).json({ error: "BODIGI_MCP_SERVER is not configured" });
  }

  try {
    const response = await fetch(`${mcpServer.replace(/\/$/, "")}/discover`, {
      headers: mcpApiKey ? { "x-api-key": mcpApiKey } : {},
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: payload.error || "MCP discovery failed" });
    }
    return res.status(200).json(payload);
  } catch {
    return res.status(502).json({ error: "Unable to reach MCP server for discovery" });
  }
});

app.post("/api/mcp/fetch", async (req, res) => {
  const mcpServer = process.env.BODIGI_MCP_SERVER;
  const mcpApiKey = process.env.BODIGI_MCP_API_KEY;
  const uri = String(req.body?.uri || "").trim();

  if (!mcpServer) {
    return res.status(503).json({ error: "BODIGI_MCP_SERVER is not configured" });
  }

  if (!uri) {
    return res.status(400).json({ error: "uri is required" });
  }

  try {
    const response = await fetch(`${mcpServer.replace(/\/$/, "")}/fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(mcpApiKey ? { "x-api-key": mcpApiKey } : {}),
      },
      body: JSON.stringify({ uri }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({ error: payload.error || "MCP fetch failed" });
    }
    return res.status(200).json(payload);
  } catch {
    return res.status(502).json({ error: "Unable to reach MCP server for fetch" });
  }
});

app.get("/manifest.webmanifest", (_req, res) => {
  res.sendFile(path.join(__dirname, "manifest.webmanifest"));
});

app.get("/sw.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "sw.js"));
});

app.use(
  express.static(path.join(__dirname), {
    index: "index.html",
    maxAge: "1h",
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=3600");
    },
  })
);

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`WHO_PAYS server listening on port ${port}`);
});
