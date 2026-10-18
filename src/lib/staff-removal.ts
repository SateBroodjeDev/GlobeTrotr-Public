export type StaffRemovalInput = {
  userId: string;
  reason: string;
  confirmation: "DELETE_STAFF_ACCOUNT";
};

export function validateStaffRemoval(input: unknown): StaffRemovalInput {
  const data = input as Partial<StaffRemovalInput> | null;
  if (!data || typeof data.userId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.userId) ||
    typeof data.reason !== "string" || data.reason.trim().length < 10 || data.reason.length > 500)
    throw new Error("INVALID_STAFF");
  // Old clients confirmed removal of the role only, not erasure of mailbox
  // content. Require the new explicit consent before reaching any server write.
  if (data.confirmation !== "DELETE_STAFF_ACCOUNT") throw new Error("STAFF_REMOVE_CONFIRMATION_REQUIRED");
  return { userId: data.userId, reason: data.reason.trim(), confirmation: data.confirmation };
}
