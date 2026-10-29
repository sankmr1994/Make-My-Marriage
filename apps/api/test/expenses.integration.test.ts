import request from "supertest";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { connectDatabase } from "../src/db/connect.js";
import { ensureCoreIndexes } from "../src/db/ensure-indexes.js";
import { Event } from "../src/models/event.js";
import { Expense } from "../src/models/expense.js";
import { Session } from "../src/models/session.js";
import { User } from "../src/models/user.js";
import { Wedding } from "../src/models/wedding.js";
import { WeddingMembership } from "../src/models/wedding-membership.js";

const describeWithMongo = env.MONGODB_URI ? describe : describe.skip;

describeWithMongo("expenses integration", () => {
  const email = `codex-expenses-${randomUUID()}@example.test`;
  let userId: string | undefined;
  let weddingId: string | undefined;

  beforeAll(async () => { await connectDatabase(); await ensureCoreIndexes(); }, 30_000);
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (weddingId) await Promise.all([Expense.deleteMany({ weddingId }), Event.deleteMany({ weddingId }), WeddingMembership.deleteMany({ weddingId }), Wedding.deleteOne({ _id: weddingId })]);
      if (userId) await Session.deleteMany({ userId });
      await User.deleteOne({ emailNormalized: email.toLowerCase() });
      await mongoose.disconnect();
    }
  }, 30_000);

  it("records, filters, rounds, updates and deletes wedding-scoped expenses", async () => {
    const client = request.agent(app);
    const signup = await client.post("/api/v1/auth/signup").send({ displayName: "Expense Test", email, password: "Initial-password-123!" });
    userId = signup.body.data.user.id as string;
    const wedding = await client.post("/api/v1/weddings").send({ couple: { brideName: "Aarav", groomName: "Meera" }, weddingDate: "2027-12-12", timeZone: "Asia/Kolkata", location: { address: "Wedding Hall", city: "Coimbatore" } });
    weddingId = wedding.body.data.wedding.id as string;
    const event = await client.post("/api/v1/events").send({ name: "Mehendi", startsAt: "2027-12-10T12:00:00+05:30", timeZone: "Asia/Kolkata", venue: { address: "Heritage Hall", city: "Coimbatore" } });
    const expense = await client.post("/api/v1/expenses").send({ description: "Mehendi artist", amountRupees: 1250.5, category: "BEAUTY_MEHENDI", eventId: event.body.data.event.id, paymentStatus: "PAID", paymentDate: "2027-10-01T12:00:00+05:30", payerName: "Aarav", notes: "Confirmed" });
    expect(expense.status).toBe(201);
    expect(expense.body.data.expense).toMatchObject({ description: "Mehendi artist", amountRupees: 1251, paymentStatus: "PAID" });
    const listed = await client.get("/api/v1/expenses?paymentStatus=PAID&category=BEAUTY_MEHENDI");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toMatchObject({ totals: { totalRupees: 1251, paidRupees: 1251, unpaidRupees: 0 } });
    const updated = await client.patch(`/api/v1/expenses/${expense.body.data.expense.id}`).send({ paymentStatus: "UNPAID", paymentDate: null });
    expect(updated.status).toBe(200);
    expect(updated.body.data.expense.paymentStatus).toBe("UNPAID");
    expect((await client.delete(`/api/v1/expenses/${expense.body.data.expense.id}`)).status).toBe(200);
    expect((await client.get("/api/v1/expenses")).body.data.expenses).toHaveLength(0);
  }, 30_000);
});
