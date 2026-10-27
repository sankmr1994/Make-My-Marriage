import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./db/connect.js";
import { ensureCoreIndexes } from "./db/ensure-indexes.js";
import mongoose from "mongoose";

async function startServer(): Promise<void> {
  await connectDatabase();
  await ensureCoreIndexes();
  const server = app.listen(env.PORT, () => {
    console.info(`Make My Marriage API listening on port ${env.PORT}`);
  });

  const shutdown = (signal: NodeJS.Signals) => {
    console.info(`Received ${signal}; closing API server.`);
    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error: unknown) => {
  console.error("API startup failed. Check MongoDB configuration and connectivity.");
  if (env.NODE_ENV !== "production" && error instanceof Error) console.error(error.message);
  process.exitCode = 1;
});
