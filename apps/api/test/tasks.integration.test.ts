import request from "supertest";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { connectDatabase } from "../src/db/connect.js";
import { ensureCoreIndexes } from "../src/db/ensure-indexes.js";
import { Event } from "../src/models/event.js";
import { Session } from "../src/models/session.js";
import { Task } from "../src/models/task.js";
import { User } from "../src/models/user.js";
import { Wedding } from "../src/models/wedding.js";
import { WeddingMembership } from "../src/models/wedding-membership.js";

const describeWithMongo = env.MONGODB_URI ? describe : describe.skip;

describeWithMongo("tasks integration", () => {
  const email = `codex-tasks-${randomUUID()}@example.test`;
  let userId: string | undefined;
  let weddingId: string | undefined;

  beforeAll(async () => { await connectDatabase(); await ensureCoreIndexes(); }, 30_000);
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (weddingId) await Promise.all([Task.deleteMany({ weddingId }), Event.deleteMany({ weddingId }), WeddingMembership.deleteMany({ weddingId }), Wedding.deleteOne({ _id: weddingId })]);
      if (userId) await Session.deleteMany({ userId });
      await User.deleteOne({ emailNormalized: email.toLowerCase() });
      await mongoose.disconnect();
    }
  }, 30_000);

  it("creates, filters, updates and permanently deletes wedding-scoped tasks", async () => {
    const client = request.agent(app);
    const signup = await client.post("/api/v1/auth/signup").send({ displayName: "Task Test", email, password: "Initial-password-123!" });
    expect(signup.status).toBe(201);
    userId = signup.body.data.user.id as string;
    const wedding = await client.post("/api/v1/weddings").send({ couple: { brideName: "Aarav", groomName: "Meera" }, weddingDate: "2027-12-12", timeZone: "Asia/Kolkata", location: { address: "Wedding Hall", city: "Coimbatore" } });
    expect(wedding.status).toBe(201);
    weddingId = wedding.body.data.wedding.id as string;
    const event = await client.post("/api/v1/events").send({ name: "Mehendi", startsAt: "2027-12-10T12:00:00+05:30", timeZone: "Asia/Kolkata", venue: { address: "Heritage Hall", city: "Coimbatore" } });
    expect(event.status).toBe(201);
    const members = await client.get("/api/v1/weddings/current/members");
    const task = await client.post("/api/v1/tasks").send({ title: "Confirm floral arrangements", description: "Confirm the marigold order.", assigneeMembershipId: members.body.data.members[0].id, eventId: event.body.data.event.id, dueAt: "2027-12-08T23:59:59+05:30", priority: "HIGH", status: "NOT_STARTED", notes: "Call the florist." });
    expect(task.status).toBe(201);
    expect(task.body.data.task).toMatchObject({ title: "Confirm floral arrangements", priority: "HIGH", status: "NOT_STARTED" });
    const listed = await client.get("/api/v1/tasks?priority=HIGH");
    expect(listed.status).toBe(200);
    expect(listed.body.data.tasks).toHaveLength(1);
    const updated = await client.patch(`/api/v1/tasks/${task.body.data.task.id}`).send({ status: "COMPLETED", assigneeMembershipId: null });
    expect(updated.status).toBe(200);
    expect(updated.body.data.task).toMatchObject({ status: "COMPLETED" });
    expect((await client.delete(`/api/v1/tasks/${task.body.data.task.id}`)).status).toBe(200);
    expect((await client.get("/api/v1/tasks")).body.data.tasks).toHaveLength(0);
  }, 30_000);
});
