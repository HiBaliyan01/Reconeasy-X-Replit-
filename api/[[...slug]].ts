import express from "express";
import type { IncomingMessage, ServerResponse } from "http";
import serverlessHttp from "serverless-http";

import { registerRoutes } from "../server/routes";

let cachedHandler: ReturnType<typeof serverlessHttp> | null = null;
let readyPromise: Promise<void> | null = null;

async function ensureHandler() {
  if (cachedHandler) return cachedHandler;
  if (!readyPromise) {
    readyPromise = (async () => {
      const app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));

      await registerRoutes(app);

      cachedHandler = serverlessHttp(app);
    })();
  }
  await readyPromise;
  if (!cachedHandler) {
    throw new Error("Failed to initialize serverless Express handler");
  }
  return cachedHandler;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const handlerFn = await ensureHandler();
  return handlerFn(req, res);
}
