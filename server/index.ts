import "dotenv/config";
import fs from "fs";
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  
  // Start notification scheduler (check every hour)
  const { taskScheduler } = await import("./src/services/scheduler");
  taskScheduler.startNotificationScheduler(60);

  // Serve standalone auth assets directly in dev/prod
  const rootDir = path.resolve(import.meta.dirname, "..");
  const authDir = path.resolve(rootDir, "client/public");
  [
    "auth.html",
    "register.html",
    "set-password.html",
    "auth.css",
    "auth.js",
    "logo.svg",
  ].forEach((file) => {
    app.get(`/${file}`, (_req, res) => {
      const candidates = [
        path.resolve(authDir, file),
        path.resolve(rootDir, file),
      ];
      const existing = candidates.find((candidate) => fs.existsSync(candidate));
      if (existing) {
        res.sendFile(existing);
      } else {
        res.status(404).send("Not found");
      }
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on configurable port (default 9000)
  const port = Number(process.env.PORT) || 9000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
