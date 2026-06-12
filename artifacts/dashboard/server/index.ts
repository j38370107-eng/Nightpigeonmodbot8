import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pool, initDb, dbGet } from "./db.js";
import authRouter from "./routes/auth.js";
import guildsRouter from "./routes/guilds.js";
import statsRouter from "./routes/stats.js";
import applyRouter from "./routes/apply.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PgStore = connectPgSimple(session);

app.set("trust proxy", 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgStore({ pool, tableName: "session", createTableIfMissing: false }),
    secret: process.env["SESSION_SECRET"] ?? "changeme-set-SESSION_SECRET-in-env",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
    },
  })
);

app.use("/api/auth", authRouter);
app.use("/api/guilds", guildsRouter);
app.use("/api/apply", applyRouter);
app.use("/api", statsRouter);

// Proxy /ping to the bot API server so uptime monitors can use the dashboard URL
app.get("/ping", async (_req: any, res: any) => {
  const botApiUrl = process.env["BOT_API_URL"] ?? "http://localhost:3000";
  try {
    const response = await fetch(`${botApiUrl}/ping`);
    const text = await response.text();
    res.status(response.status).send(text);
  } catch {
    res.status(503).send("Bot API unreachable");
  }
});

// process.cwd() is always the project root (artifacts/dashboard),
// regardless of whether this file is running as source (server/) or
// compiled bundle (dist/server/). Using __dirname would double the
// "dist" segment in production and cause ENOENT errors.
const clientDist = path.resolve(process.cwd(), "dist/client");

// ── Dynamic OG tags for application form links ────────────────────────────────
// Must be registered BEFORE express.static so this route always wins.
// Discord scrapes the URL and reads the <meta> tags — we inject the real
// form title + description so the embed shows the application name, not the
// generic dashboard description.
app.get("/apply/:guildId/:formId", async (req: any, res: any) => {
  const { guildId, formId } = req.params as { guildId: string; formId: string };
  const indexPath = path.join(clientDist, "index.html");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    let html = fs.readFileSync(indexPath, "utf8");

    const forms = await dbGet<Record<string, any>>("applicationForms", guildId);
    const form  = forms?.[formId];

    if (form?.title) {
      const title = `📋 ${form.title}`;
      const desc  = form.description?.trim()
        ? form.description.trim()
        : `Submit your application for ${form.title}.`;

      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
        .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/,       `$1${esc(title)}$2`)
        .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/,  `$1${esc(desc)}$2`)
        .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/,          `$1${esc(desc)}$2`);
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[og] Failed to inject OG tags:", err);
    res.sendFile(indexPath);
  }
});

app.use(express.static(clientDist));

app.get("/{*splat}", (_req: any, res: any) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const port = Number(process.env["DASHBOARD_PORT"] ?? process.env["PORT"] ?? 4000);

initDb()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Dashboard running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize DB:", err);
    process.exit(1);
  });
