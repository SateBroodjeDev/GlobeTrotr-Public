type Mailbox = { id: string; active: boolean; owner_user_id?: string | null; [key: string]: unknown };
type Membership = { permission: string; corporate_mailboxes: Mailbox | null };

export function corporateMailboxAccess(owned: Mailbox[], memberships: Membership[]) {
  const result = new Map<string, Mailbox & { permission: string }>();
  // Ownership takes precedence over a redundant lower-permission member row.
  for (const mailbox of owned) {
    if (mailbox.id && mailbox.active === true)
      result.set(mailbox.id, { ...mailbox, permission: "manage" });
  }
  for (const membership of memberships) {
    const mailbox = membership.corporate_mailboxes;
    if (mailbox?.id && mailbox.active === true && !result.has(mailbox.id))
      result.set(mailbox.id, { ...mailbox, permission: membership.permission });
  }
  return [...result.values()];
}
