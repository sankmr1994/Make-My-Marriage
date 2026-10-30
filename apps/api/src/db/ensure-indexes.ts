import { AuthRateLimit } from "../models/auth-rate-limit.js";
import { PasswordResetToken } from "../models/password-reset-token.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { WeddingMembership } from "../models/wedding-membership.js";
import { Wedding } from "../models/wedding.js";
import { Event } from "../models/event.js";
import { MembershipInvitation } from "../models/membership-invitation.js";
import { Task } from "../models/task.js";
import { Expense } from "../models/expense.js";
import { Guest } from "../models/guest.js";
import { EventGuest } from "../models/event-guest.js";
import { GuestInvitation } from "../models/guest-invitation.js";

export async function ensureCoreIndexes(): Promise<void> {
  await Promise.all([
    User.createIndexes(),
    Session.createIndexes(),
    PasswordResetToken.createIndexes(),
    WeddingMembership.createIndexes(),
    Wedding.createIndexes(),
    Event.createIndexes(),
    MembershipInvitation.createIndexes(),
    Task.createIndexes(),
    Expense.createIndexes(),
    Guest.createIndexes(),
    EventGuest.createIndexes(),
    GuestInvitation.createIndexes(),
    AuthRateLimit.createIndexes()
  ]);
  console.info("Core account and session indexes are ready.");
}
