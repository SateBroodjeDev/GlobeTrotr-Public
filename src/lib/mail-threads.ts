export type ThreadedMail = {
  id: string;
  thread_key?: string | null;
  provider_message_id?: string | null;
  received_at?: string | null;
  created_at?: string | null;
  direction?: string;
  read_at?: string | null;
  mail_folder?: string;
};

export function mailThreadKey(message: ThreadedMail) {
  return message.thread_key || message.provider_message_id || message.id;
}

export function groupMailThreads<T extends ThreadedMail>(messages: T[]) {
  const groups = new Map<string, T[]>();
  for (const message of messages) {
    const key = mailThreadKey(message);
    groups.set(key, [...(groups.get(key) || []), message]);
  }
  return [...groups.values()].map((thread) => ({
    ...thread[0],
    threadCount: thread.length,
    unreadCount: thread.filter((message) => message.direction === "inbound" && !message.read_at).length,
  }));
}

export function messagesInThread<T extends ThreadedMail>(messages: T[], selected: T) {
  const selectedKey = mailThreadKey(selected);
  return messages
    .filter((message) => mailThreadKey(message) === selectedKey &&
      (message.mail_folder || "inbox") === (selected.mail_folder || "inbox"))
    .sort(
      (left, right) =>
        new Date(left.received_at || left.created_at || 0).getTime() -
        new Date(right.received_at || right.created_at || 0).getTime(),
    );
}
