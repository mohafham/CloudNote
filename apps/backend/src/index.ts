import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";

const port = Number(process.env.PORT ?? env.API_PORT);

const server = app.listen(port, () => {
  console.log(`Backend API listening on port ${port}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
