import mongoose from "mongoose";
import type { RequestHandler } from "express";
import { connectDatabase } from "../db/connect.js";
import { ensureCoreIndexes } from "../db/ensure-indexes.js";

let databaseInitialization: Promise<void> | undefined;

async function ensureDatabaseReady(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (mongoose.connection.readyState === 0) databaseInitialization = undefined;

  if (!databaseInitialization) {
    databaseInitialization = connectDatabase()
      .then(() => ensureCoreIndexes())
      .catch((error: unknown) => {
        databaseInitialization = undefined;
        throw error;
      });
  }

  await databaseInitialization;
}

export const requireDatabase: RequestHandler = (_request, _response, next) => {
  void ensureDatabaseReady().then(() => next(), next);
};
