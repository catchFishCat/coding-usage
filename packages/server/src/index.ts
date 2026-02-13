import Fastify from "fastify";
import cors from "@fastify/cors";
import { getQuotaStatusSnapshot } from "@coding-usage/core";

export function buildServer() {
  const app = Fastify({ logger: false });

  void app.register(cors, { origin: true });

  app.get("/health", async () => {
    return { ok: true, service: "coding-usage-server" };
  });

  app.get("/status", async () => {
    const snapshot = getQuotaStatusSnapshot();
    return {
      generatedAt: Date.now(),
      count: snapshot.length,
      data: snapshot,
    };
  });

  return app;
}

export async function startServer(port = 8787) {
  const app = buildServer();
  await app.listen({ port, host: "127.0.0.1" });
  return app;
}

const isDirectRun = process.argv[1]?.endsWith("index.js");

if (isDirectRun) {
  const port = Number(process.env.PORT || 8787);
  startServer(port).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
