import request from "supertest";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { connectDatabase } from "../src/db/connect.js";
import { ensureCoreIndexes } from "../src/db/ensure-indexes.js";
import { PasswordResetToken } from "../src/models/password-reset-token.js";
import { Session } from "../src/models/session.js";
import { User } from "../src/models/user.js";
import { createOpaqueToken, hashOpaqueToken } from "../src/utils/credentials.js";

const describeWithMongo = env.MONGODB_URI ? describe : describe.skip;

describeWithMongo("authentication integration", () => {
  const email = `codex-auth-${randomUUID()}@example.test`;
  const normalizedEmail = email.toLowerCase();
  let userId: string | undefined;

  beforeAll(async () => {
    await connectDatabase();
    await ensureCoreIndexes();
  }, 30_000);

  afterAll(async () => {
    if (userId) {
      await Promise.all([
        Session.deleteMany({ userId }),
        PasswordResetToken.deleteMany({ userId }),
        User.deleteOne({ _id: userId })
      ]);
    }
    await mongoose.disconnect();
  }, 30_000);

  it("signs up, signs in, resets a password, invalidates sessions, and logs out", async () => {
    const password = "Initial-password-123!";
    const newPassword = "Replacement-password-456!";
    const client = request.agent(app);

    const signup = await client.post("/api/v1/auth/signup").send({ displayName: "Test User", email, password });
    expect(signup.status).toBe(201);
    expect(signup.body.data.user).toMatchObject({ displayName: "Test User", email });
    expect(signup.body.data.user).not.toHaveProperty("passwordHash");
    expect(signup.headers["set-cookie"][0]).toContain("HttpOnly");
    userId = signup.body.data.user.id as string;

    const current = await client.get("/api/v1/auth/me");
    expect(current.status).toBe(200);
    expect(current.body.data.user.id).toBe(userId);
    expect(current.body.data.membership).toBeNull();

    const duplicate = await request(app).post("/api/v1/auth/signup").send({
      displayName: "Duplicate User",
      email: email.toUpperCase(),
      password
    });
    expect(duplicate.status).toBe(409);

    const wrongPassword = await request(app).post("/api/v1/auth/login").send({ email, password: "Wrong-password-123!" });
    expect(wrongPassword.status).toBe(401);

    const login = await client.post("/api/v1/auth/login").send({ email: email.toUpperCase(), password });
    expect(login.status).toBe(200);
    expect(login.body.data.user.id).toBe(userId);

    const resetRequest = await request(app).post("/api/v1/auth/password-reset/request").send({ email: `missing-${normalizedEmail}` });
    expect(resetRequest.status).toBe(202);
    expect(resetRequest.body.data.message).toMatch(/If an account matches/);

    const resetToken = createOpaqueToken();
    await PasswordResetToken.create({
      userId,
      tokenHash: hashOpaqueToken(resetToken),
      expiresAt: new Date(Date.now() + 60_000)
    });

    const reset = await request(app).post("/api/v1/auth/password-reset/confirm").send({ token: resetToken, newPassword });
    expect(reset.status).toBe(200);

    const invalidatedSession = await client.get("/api/v1/auth/me");
    expect(invalidatedSession.status).toBe(401);

    const reusedToken = await request(app).post("/api/v1/auth/password-reset/confirm").send({ token: resetToken, newPassword });
    expect(reusedToken.status).toBe(410);

    const oldPasswordLogin = await request(app).post("/api/v1/auth/login").send({ email, password });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await client.post("/api/v1/auth/login").send({ email, password: newPassword });
    expect(newPasswordLogin.status).toBe(200);

    const logout = await client.post("/api/v1/auth/logout");
    expect(logout.status).toBe(204);

    const unauthenticated = await client.get("/api/v1/auth/me");
    expect(unauthenticated.status).toBe(401);
  }, 30_000);
});
