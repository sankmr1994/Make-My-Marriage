import request from "supertest";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { connectDatabase } from "../src/db/connect.js";
import { ensureCoreIndexes } from "../src/db/ensure-indexes.js";
import { MembershipInvitation } from "../src/models/membership-invitation.js";
import { Session } from "../src/models/session.js";
import { User } from "../src/models/user.js";
import { Wedding } from "../src/models/wedding.js";
import { WeddingMembership } from "../src/models/wedding-membership.js";

const describeWithMongo = env.MONGODB_URI ? describe : describe.skip;

describeWithMongo("membership invitations integration", () => {
  const suffix = randomUUID();
  const adminEmail = `codex-team-admin-${suffix}@example.test`;
  const organiserEmail = `codex-team-organiser-${suffix}@example.test`;
  const partnerEmail = `codex-team-partner-${suffix}@example.test`;
  const otherEmail = `codex-team-other-${suffix}@example.test`;
  const extraEmail = `codex-team-extra-${suffix}@example.test`;
  const testEmails = [adminEmail, organiserEmail, partnerEmail, otherEmail, extraEmail].map((email) => email.toLowerCase());
  const users: string[] = [];
  let weddingId: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  const originalResendKey = env.RESEND_API_KEY;
  const originalResendFrom = env.RESEND_FROM_EMAIL;

  beforeAll(async () => {
    await connectDatabase();
    await ensureCoreIndexes();
    originalFetch = globalThis.fetch;
    env.RESEND_API_KEY = "re_test_key";
    env.RESEND_FROM_EMAIL = "wedding@example.test";
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "resend-test-message" }), { status: 200, headers: { "Content-Type": "application/json" } }));
  }, 30_000);

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    env.RESEND_API_KEY = originalResendKey;
    env.RESEND_FROM_EMAIL = originalResendFrom;
    if (mongoose.connection.readyState === 1) {
      if (weddingId) {
        await Promise.all([
          MembershipInvitation.deleteMany({ weddingId }),
          WeddingMembership.deleteMany({ weddingId }),
          Wedding.deleteOne({ _id: weddingId })
        ]);
      }
      if (users.length) await Session.deleteMany({ userId: { $in: users } });
      await User.deleteMany({ emailNormalized: { $in: testEmails } });
      await mongoose.disconnect();
    }
  }, 30_000);

  it("validates, sends, accepts, revokes and removes wedding team access", async () => {
    const admin = request.agent(app);
    const signup = await admin.post("/api/v1/auth/signup").send({ displayName: "Test Admin", email: adminEmail, password: "Initial-password-123!" });
    expect(signup.status).toBe(201);
    users.push(signup.body.data.user.id as string);
    const created = await admin.post("/api/v1/weddings").send({ couple: { brideName: "Aarav", groomName: "Meera" }, weddingDate: "2027-12-12", timeZone: "Asia/Kolkata", location: { address: "Wedding Hall", city: "Coimbatore" } });
    expect(created.status).toBe(201);
    weddingId = created.body.data.wedding.id as string;

    const invalid = await admin.post("/api/v1/weddings/current/membership-invitations").send({ email: "not-an-email", role: "GUEST" });
    expect(invalid.status).toBe(400);
    const invite = await admin.post("/api/v1/weddings/current/membership-invitations").send({ email: organiserEmail, role: "ORGANISER" });
    expect(invite.status).toBe(201);
    expect(invite.body.data.invitation).not.toHaveProperty("token");
    const duplicate = await admin.post("/api/v1/weddings/current/membership-invitations").send({ email: organiserEmail.toUpperCase(), role: "ORGANISER" });
    expect(duplicate.status).toBe(409);

    const resentEmailCall = vi.mocked(globalThis.fetch).mock.calls.find((call) => String(call[0]).includes("api.resend.com"));
    expect(resentEmailCall).toBeDefined();
    const emailBody = JSON.parse(String(resentEmailCall?.[1]?.body)) as { html: string };
    const acceptUrl = emailBody.html.match(/href="([^"]*accept-invitation[^"]*)"/)?.[1];
    expect(acceptUrl).toBeDefined();
    const invitationToken = new URL(acceptUrl!).searchParams.get("token");
    expect(invitationToken).toBeTruthy();
    const inviteDetails = await request(app).get(`/api/v1/membership-invitations/${invitationToken}`);
    expect(inviteDetails.status).toBe(200);
    expect(inviteDetails.body.data.invitation).toMatchObject({ email: organiserEmail.toLowerCase(), role: "ORGANISER", status: "PENDING" });

    const organiser = request.agent(app);
    const organiserSignup = await organiser.post("/api/v1/auth/signup").send({ displayName: "Test Organiser", email: organiserEmail, password: "Initial-password-123!" });
    expect(organiserSignup.status).toBe(201);
    users.push(organiserSignup.body.data.user.id as string);
    const accepted = await organiser.post("/api/v1/membership-invitations/accept").send({ token: invitationToken });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data).toMatchObject({ accepted: true, role: "ORGANISER", weddingId });
    expect((await organiser.get("/api/v1/auth/me")).body.data.membership).toMatchObject({ weddingId, role: "ORGANISER" });
    expect((await organiser.get("/api/v1/weddings/current/membership-invitations")).status).toBe(403);
    expect((await organiser.post("/api/v1/weddings/current/membership-invitations").send({ email: otherEmail, role: "ORGANISER" })).status).toBe(403);
    expect((await organiser.post("/api/v1/membership-invitations/accept").send({ token: invitationToken })).status).toBe(410);

    const mismatchInvite = await admin.post("/api/v1/weddings/current/membership-invitations").send({ email: otherEmail, role: "ORGANISER" });
    expect(mismatchInvite.status).toBe(201);
    const mismatchEmailCall = vi.mocked(globalThis.fetch).mock.calls.filter((call) => String(call[0]).includes("api.resend.com")).at(-1);
    const mismatchBody = JSON.parse(String(mismatchEmailCall?.[1]?.body)) as { html: string };
    const mismatchLink = mismatchBody.html.match(/href="([^"]*accept-invitation[^"]*)"/)?.[1];
    const mismatchToken = new URL(mismatchLink!).searchParams.get("token");
    expect((await admin.post("/api/v1/membership-invitations/accept").send({ token: mismatchToken })).status).toBe(403);
    const inviteToRevoke = mismatchInvite.body.data.invitation.id as string;
    const refreshed = await admin.post(`/api/v1/weddings/current/membership-invitations/${inviteToRevoke}/resend`);
    expect(refreshed.status).toBe(201);
    expect((await request(app).get(`/api/v1/membership-invitations/${mismatchToken}`)).body.data.invitation.status).toBe("REVOKED");
    expect((await admin.delete(`/api/v1/weddings/current/membership-invitations/${refreshed.body.data.invitation.id}`)).status).toBe(200);

    const partnerInvite = await admin.post("/api/v1/weddings/current/membership-invitations").send({ email: partnerEmail, role: "ADMIN" });
    expect(partnerInvite.status).toBe(201);
    const competingAdminInvite = await admin.post("/api/v1/weddings/current/membership-invitations").send({ email: extraEmail, role: "ADMIN" });
    expect(competingAdminInvite.status).toBe(409);

    const partner = request.agent(app);
    const partnerSignup = await partner.post("/api/v1/auth/signup").send({ displayName: "Test Partner", email: partnerEmail, password: "Initial-password-123!" });
    expect(partnerSignup.status).toBe(201);
    users.push(partnerSignup.body.data.user.id as string);
    const partnerEmailCall = vi.mocked(globalThis.fetch).mock.calls.filter((call) => String(call[0]).includes("api.resend.com")).at(-1);
    const partnerBody = JSON.parse(String(partnerEmailCall?.[1]?.body)) as { html: string };
    const partnerLink = partnerBody.html.match(/href="([^"]*accept-invitation[^"]*)"/)?.[1];
    const partnerToken = new URL(partnerLink!).searchParams.get("token");
    expect((await partner.post("/api/v1/membership-invitations/accept").send({ token: partnerToken })).status).toBe(200);
    const memberList = await admin.get("/api/v1/weddings/current/members");
    expect(memberList.body.data.members).toHaveLength(3);
    const creatorMembership = memberList.body.data.members.find((member: { isWorkspaceCreator: boolean }) => member.isWorkspaceCreator);
    const partnerMembership = memberList.body.data.members.find((member: { role: string; userId: string }) => member.role === "ADMIN" && member.userId !== signup.body.data.user.id);
    expect(creatorMembership).toBeDefined();
    expect((await admin.delete(`/api/v1/weddings/current/members/${creatorMembership.id}`)).status).toBe(403);
    expect((await partner.delete(`/api/v1/weddings/current/members/${creatorMembership.id}`)).status).toBe(403);
    expect((await organiser.delete(`/api/v1/weddings/current/members/${creatorMembership.id}`)).status).toBe(403);
    expect((await admin.get("/api/v1/weddings/current/members")).body.data.members).toHaveLength(3);

    const organiserMembership = memberList.body.data.members.find((member: { role: string }) => member.role === "ORGANISER");
    expect((await organiser.delete(`/api/v1/weddings/current/members/${organiserMembership.id}`)).status).toBe(403);
    expect((await admin.delete(`/api/v1/weddings/current/members/${organiserMembership.id}`)).status).toBe(200);
    expect(await User.exists({ _id: organiserSignup.body.data.user.id })).toBeTruthy();
    expect((await admin.delete(`/api/v1/weddings/current/members/${partnerMembership.id}`)).status).toBe(200);
    expect(await WeddingMembership.exists({ _id: partnerMembership.id, status: "REMOVED" })).toBeTruthy();
  }, 60_000);
});
