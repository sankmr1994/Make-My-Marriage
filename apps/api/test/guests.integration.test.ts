import request from "supertest";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { connectDatabase } from "../src/db/connect.js";
import { ensureCoreIndexes } from "../src/db/ensure-indexes.js";
import { Event } from "../src/models/event.js";
import { EventGuest } from "../src/models/event-guest.js";
import { Guest } from "../src/models/guest.js";
import { GuestInvitation } from "../src/models/guest-invitation.js";
import { Session } from "../src/models/session.js";
import { User } from "../src/models/user.js";
import { Wedding } from "../src/models/wedding.js";
import { WeddingMembership } from "../src/models/wedding-membership.js";
import { createOpaqueToken, hashOpaqueToken } from "../src/utils/credentials.js";

const describeWithMongo = env.MONGODB_URI ? describe : describe.skip;

describeWithMongo("guest and RSVP integration", () => {
  const email = `codex-guests-${randomUUID()}@example.test`;
  let userId: string | undefined; let weddingId: string | undefined;
  beforeAll(async () => { await connectDatabase(); await ensureCoreIndexes(); }, 30_000);
  afterAll(async () => { if (mongoose.connection.readyState === 1) { if (weddingId) { await Promise.all([GuestInvitation.deleteMany({ weddingId }), EventGuest.deleteMany({ weddingId }), Guest.deleteMany({ weddingId }), Event.deleteMany({ weddingId }), WeddingMembership.deleteMany({ weddingId }), Wedding.deleteOne({ _id: weddingId })]); } if (userId) await Session.deleteMany({ userId }); await User.deleteOne({ emailNormalized: email }); await mongoose.disconnect(); } }, 30_000);
  it("manages family households, ceremony RSVPs, and accountless RSVP links", async () => {
    const client = request.agent(app); const signup = await client.post("/api/v1/auth/signup").send({ displayName: "Guest Test", email, password: "Initial-password-123!" }); expect(signup.status).toBe(201); userId = signup.body.data.user.id;
    const wedding = await client.post("/api/v1/weddings").send({ couple: { brideName: "Aarav", groomName: "Meera" }, weddingDate: "2027-12-12", timeZone: "Asia/Kolkata", location: { address: "Wedding Hall", city: "Coimbatore" } }); expect(wedding.status).toBe(201); weddingId = wedding.body.data.wedding.id;
    const event = await client.post("/api/v1/events").send({ name: "Mehendi", startsAt: "2027-12-10T12:00:00+05:30", timeZone: "Asia/Kolkata", venue: { address: "Heritage Hall", city: "Coimbatore" } }); expect(event.status).toBe(201);
    const guest = await client.post("/api/v1/guests").send({ primaryContactName: "Sundaram Natarajan", email: "sundaram@example.test", familyCount: 4, eventIds: [event.body.data.event.id] }); expect(guest.status).toBe(201);
    expect((await client.post("/api/v1/guests").send({ primaryContactName: "Duplicate", email: "SUNDARAM@example.test", familyCount: 2 })).status).toBe(409);
    const listed = await client.get("/api/v1/guests"); expect(listed.status).toBe(200); expect(listed.body.data.summary).toMatchObject({ families: 1, headcount: 4 });
    const rawToken = createOpaqueToken(); await GuestInvitation.create({ weddingId, eventId: event.body.data.event.id, guestId: guest.body.data.guest.id, tokenHash: hashOpaqueToken(rawToken), emailSubmissionStatus: "NOT_CONFIGURED", expiresAt: new Date(Date.now() + 60_000), createdByUserId: userId });
    const publicInvitation = await request(app).get(`/api/v1/guest-rsvps/${rawToken}`); expect(publicInvitation.status).toBe(200); expect(publicInvitation.body.data).toMatchObject({ status: "ACTIVE", family: { familyCount: 4 }, rsvpStatus: "PENDING" });
    const rsvp = await request(app).post(`/api/v1/guest-rsvps/${rawToken}`).send({ response: "ATTENDING" }); expect(rsvp.status).toBe(200); expect(rsvp.body.data.rsvpStatus).toBe("ATTENDING");
    const assignments = await client.get(`/api/v1/events/${event.body.data.event.id}/guest-assignments`); expect(assignments.status).toBe(200); expect(assignments.body.data.summary).toMatchObject({ families: 1, attending: 1, headcount: 4 });
    expect((await client.delete(`/api/v1/guests/${guest.body.data.guest.id}`)).status).toBe(200); expect((await client.get("/api/v1/guests")).body.data.summary.families).toBe(0);
    expect((await client.post("/api/v1/guests").send({ primaryContactName: "Duplicate after archive", email: "sundaram@example.test", familyCount: 2 })).status).toBe(409);
    expect((await client.get("/api/v1/guests?status=ARCHIVED")).body.data.summary.families).toBe(1);
    expect((await client.post(`/api/v1/guests/${guest.body.data.guest.id}/unarchive`)).status).toBe(200);
    expect((await client.patch(`/api/v1/guests/${guest.body.data.guest.id}`).send({ email: "sundaram-previous@example.test" })).status).toBe(200);
    expect((await client.post("/api/v1/guests").send({ primaryContactName: "New family", email: "sundaram@example.test", familyCount: 2 })).status).toBe(201);
  }, 30_000);
});
