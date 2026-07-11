import express from "express";
import path from "node:path";
import { ensureRuntimeFolders, loadSettings } from "./config/settings.js";
import { secrets } from "./config/secrets.js";
import { dashboardRouter } from "./modules/dashboard/routes.js";
import { apiRouter } from "./modules/dashboard/api.js";
import { audit } from "./safety/auditLogger.js";

ensureRuntimeFolders();

const settings = loadSettings();
const app = express();
const port = Number(secrets.dashboardPort || settings.agent.dashboardPort || 8788);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.resolve(process.cwd(), "public")));
app.use("/", dashboardRouter);
app.use("/api", apiRouter);

app.listen(port, () => {
  audit("server", "listen", `Painel iniciado em http://localhost:${port}`);
  console.log(`Painel iniciado em http://localhost:${port}`);
});
