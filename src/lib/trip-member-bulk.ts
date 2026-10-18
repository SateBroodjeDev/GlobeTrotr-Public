import type { TripMemberRole } from "./types";

export type BulkTripInvite = { name: string; email: string; role: TripMemberRole };
export type BulkTripInviteIssue = { line: number; value: string; reason: "invalid" | "duplicate" | "existing" | "role" };
const EMAIL = /^\S+@\S+\.\S+$/;

export function parseBulkTripInvites(input: string, allowedRoles: TripMemberRole[], existingEmails: string[]) {
  const existing = new Set(existingEmails.map((email) => email.trim().toLowerCase()));
  const seen = new Set<string>();
  const invites: BulkTripInvite[] = [];
  const issues: BulkTripInviteIssue[] = [];
  input.split(/\r?\n/).forEach((raw, index) => {
    const value = raw.trim();
    if (!value) return;
    const parts = value.split(/[;,]/).map((part) => part.trim());
    const emailIndex = parts.findIndex((part) => EMAIL.test(part));
    const email = emailIndex >= 0 ? parts[emailIndex].toLowerCase() : "";
    const role = parts.find((part) => allowedRoles.includes(part as TripMemberRole)) as TripMemberRole | undefined;
    const name = parts.find((part, partIndex) => partIndex !== emailIndex && part !== role)?.slice(0, 120) || email.split("@")[0] || "";
    if (!email || !name) return void issues.push({ line: index + 1, value, reason: "invalid" });
    if (!role) return void issues.push({ line: index + 1, value, reason: "role" });
    if (existing.has(email)) return void issues.push({ line: index + 1, value, reason: "existing" });
    if (seen.has(email)) return void issues.push({ line: index + 1, value, reason: "duplicate" });
    seen.add(email); invites.push({ name, email, role });
  });
  return { invites, issues };
}

export function tripRoleAccess(role: TripMemberRole) {
  return ({ owner: ["view", "plan", "expenses", "members"], traveler: ["view", "plan", "expenses"], viewer: ["view"], advisor: ["view", "plan"], finance: ["view", "expenses"], client: ["view"] } satisfies Record<TripMemberRole, string[]>)[role];
}
