const tripAddress = /^trip\.[a-f0-9]{12}@globetrotr\.nl$/;
const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export function mailRecipients(parsed) {
  const recipients = [...(parsed.to?.value || []), ...(parsed.cc?.value || [])].map((item) =>
    normalize(item.address),
  );
  function collect(value) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (value && typeof value === "object")
      return collect(value.value ?? value.address ?? value.text);
    for (const address of String(value || "").match(/[^\s<>;,]+@[^\s<>;,]+/g) || [])
      recipients.push(normalize(address));
  }
  for (const name of [
    "delivered-to",
    "x-original-to",
    "envelope-to",
    "x-envelope-to",
    "original-recipient",
  ])
    collect(parsed.headers?.get(name));
  return [...new Set(recipients.filter(Boolean))];
}

export function routeBookingMail({ recipients, mailboxes, addresses, enabled, inboxAddress }) {
  const byAddress = new Map(addresses.map((item) => [normalize(item.address), item]));
  const tripRecipients = recipients.filter((address) => tripAddress.test(address));
  const matched = tripRecipients.map((address) => byAddress.get(address)).filter(Boolean);
  const connectionIds = new Set(mailboxes.map((box) => box.id));
  return {
    bookingTargets: enabled
      ? matched.filter((item) => item.active && connectionIds.has(item.mailbox_id))
      : [],
    corporateTargets: mailboxes.filter(
      (box) =>
        recipients.includes(normalize(box.address)) &&
        !(
          tripRecipients.length &&
          (normalize(box.address) === normalize(inboxAddress) ||
            matched.some((item) => item.mailbox_id === box.id))
        ),
    ),
  };
}

export function bookingSourceExpiry(address, receivedAt, now = Date.now()) {
  const received = new Date(receivedAt).getTime();
  if (!Number.isFinite(received)) return undefined;
  const retention = Math.min(365, Math.max(1, Number(address.retention_days) || 30));
  const expiry = received + retention * 86_400_000;
  return expiry > now ? new Date(expiry).toISOString() : undefined;
}

export function bookingJunkFolders(folders, importFolder, mailboxes, addresses, enabled) {
  if (
    !enabled ||
    !addresses.some(
      (address) => address.active && mailboxes.some((box) => box.id === address.mailbox_id),
    )
  )
    return [];
  return folders
    .filter(
      (folder) =>
        folder.path !== importFolder &&
        !folder.flags?.has("\\Noselect") &&
        (folder.specialUse === "\\Junk" || /(?:^|[/.])(junk|spam)$/i.test(folder.path)),
    )
    .slice(0, 2)
    .map((folder) => folder.path);
}

export function eligibleJunkBooking({
  parsed,
  receivedAt,
  mailboxes,
  addresses,
  enabled,
  inboxAddress,
  now,
}) {
  const sender = normalize(parsed.from?.value?.[0]?.address);
  const { bookingTargets } = routeBookingMail({
    recipients: mailRecipients(parsed),
    mailboxes,
    addresses,
    enabled,
    inboxAddress,
  });
  return bookingTargets.some(
    (address) =>
      bookingSourceExpiry(address, receivedAt, now) &&
      (!(address.allowed_senders || []).length ||
        address.allowed_senders.some((value) => normalize(value) === sender)),
  );
}
