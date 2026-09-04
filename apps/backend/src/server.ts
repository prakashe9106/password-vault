import Fastify from "fastify";

/**
 * Minimal scaffold. Per the PRD (§10), the backend is intentionally small: sensitive vault
 * operations happen entirely on clients. Auth, billing, and Google Drive OAuth land in a later
 * phase — this increment only proves the service boots and reports health.
 */
const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

const port = Number(process.env.PORT ?? 8787);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
