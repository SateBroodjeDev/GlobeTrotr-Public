import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  FileText,
  Inbox,
  Languages,
  Loader2,
  Mail,
  Download,
  Paperclip,
  Reply,
  RotateCcw,
  Search,
  Send,
  Trash2,
  ShieldAlert,
  MailOpen,
} from "lucide-react";
import { toast } from "sonner";
import { RichMailEditor } from "@/components/mail/RichMailEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteCorporateMailDraft,
  deleteCorporateMailMessage,
  setCorporateMailRetention,
  getMyCorporateMail,
  queueCorporateMail,
  saveCorporateMailDraft,
  translateCorporateMailDraft,
  updateCorporateMailMessage,
  prepareCorporateMailAttachments,
  getCorporateMailAttachmentUrl,
  getCorporateMailInlineImages,
  retryCorporateMailDelivery,
} from "@/lib/corporate-business.functions";
import { supabase } from "@/integrations/supabase/client";
import { mailHtmlForDisplay, plainTextToMailHtml } from "@/lib/safe-mail-html";
import { groupMailThreads, messagesInThread } from "@/lib/mail-threads";
import { inferMailAttachmentType } from "@/lib/mail-attachments";
import { resolveInlineMailImages } from "@/lib/mail-inline-images";
import { useLocale } from "@/lib/locale";

export const Route = createFileRoute("/_authenticated/company-mail")({
  validateSearch: (search: Record<string, unknown>) => ({
    to: typeof search.to === "string" ? search.to.slice(0, 254) : "",
    subject: typeof search.subject === "string" ? search.subject.slice(0, 200) : "",
  }),
  component: CompanyMail,
});
type Folder = "inbox" | "junk" | "sent" | "drafts" | "outbox" | "archive";
type Compose = {
  open: boolean;
  draftId: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  bodyHtml: string;
  replyToId: string;
  files: File[];
};
const blank = (open = false): Compose => ({
  open,
  draftId: "",
  to: "",
  cc: "",
  subject: "",
  body: "",
  bodyHtml: "",
  replyToId: "",
  files: [],
});

function CompanyMail() {
  const { text, locale } = useLocale();
  const searchParams = Route.useSearch();
  const qc = useQueryClient();
  const [mailboxId, setMailboxId] = useState("");
  const [folder, setFolder] = useState<Folder>("inbox");
  const [search, setSearch] = useState("");
  const [archiveLimit, setArchiveLimit] = useState(10);
  useEffect(() => {
    const reload = () => { void qc.invalidateQueries({ queryKey: ["my-company-mail"] }); };
    window.addEventListener("corporate-mail-retention-changed", reload);
    return () => window.removeEventListener("corporate-mail-retention-changed", reload);
  }, [qc]);
  const [selected, setSelected] = useState<any>();
  const [compose, setCompose] = useState<Compose>({
    ...blank(Boolean(searchParams.to)),
    to: searchParams.to,
    subject: searchParams.subject,
  });
  const query = useQuery({
    queryKey: ["my-company-mail", mailboxId, archiveLimit],
    queryFn: () => getMyCorporateMail({ data: { mailboxId: mailboxId || undefined, archiveLimit } }),
  });
  const activeId = mailboxId || query.data?.selected?.id || "";
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-company-mail"] });
  const saveDraft = useMutation({
    mutationFn: () =>
      saveCorporateMailDraft({
        data: {
          id: compose.draftId || undefined,
          mailboxId: activeId,
          recipients: split(compose.to),
          cc: split(compose.cc),
          subject: compose.subject,
          body: compose.body,
          bodyHtml: compose.bodyHtml,
          replyToId: compose.replyToId || undefined,
        },
      }),
    onSuccess: (saved: any) => {
      setCompose((value) => (value.draftId === saved.id ? value : { ...value, draftId: saved.id }));
      void refresh();
    },
    onError: () =>
      toast.error(text("Concept kon niet worden opgeslagen.", "Draft could not be saved.")),
  });
  const saveDraftRef = useRef<() => void>(() => undefined);
  saveDraftRef.current = () => saveDraft.mutate();
  useEffect(() => {
    if (
      saveDraft.isPending ||
      !compose.open ||
      !activeId ||
      (!compose.to && !compose.subject && !compose.body)
    )
      return;
    const timer = setTimeout(() => saveDraftRef.current(), 1200);
    return () => clearTimeout(timer);
  }, [
    activeId,
    compose.open,
    compose.draftId,
    compose.to,
    compose.cc,
    compose.subject,
    compose.body,
    compose.bodyHtml,
    compose.replyToId,
    saveDraft.isPending,
  ]);
  const send = useMutation({
    mutationFn: async () => {
      const metadata = await Promise.all(
        compose.files.map(async (file) => ({
          fileName: file.name,
          contentType: inferMailAttachmentType(file),
          sizeBytes: file.size,
          sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))]
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
        })),
      );
      const prepared = metadata.length
        ? await prepareCorporateMailAttachments({ data: { mailboxId: activeId, files: metadata } })
        : [];
      for (let index = 0; index < prepared.length; index += 1) {
        const upload = prepared[index];
        const { error } = await supabase.storage
          .from("corporate-mail")
          .uploadToSignedUrl(upload.storageKey, upload.token, compose.files[index], {
            contentType: upload.contentType,
          });
        if (error) throw error;
      }
      return queueCorporateMail({
        data: {
          mailboxId: activeId,
          recipients: split(compose.to),
          cc: split(compose.cc),
          subject: compose.subject,
          body: compose.body,
          bodyHtml: compose.bodyHtml,
          replyToId: compose.replyToId || undefined,
          draftId: compose.draftId || undefined,
          attachments: prepared.map(({ token: _token, ...attachment }) => attachment),
        },
      });
    },
    onSuccess: async (result: any) => {
      toast.success(
        result.status === "pending"
          ? text("Bericht klaargezet voor verzending.", "Message queued for delivery.")
          : text("Bericht in de testwachtrij geplaatst.", "Message placed in the test queue."),
      );
      setCompose(blank());
      setFolder("outbox");
      await refresh();
    },
    onError: () =>
      toast.error(text("Bericht kon niet worden klaargezet.", "Message could not be queued.")),
  });
  const translate = useMutation({
    mutationFn: async (direction: "nl-en" | "en-nl") => {
      const language = {
        source: direction === "nl-en" ? ("nl" as const) : ("en" as const),
        target: direction === "nl-en" ? ("en" as const) : ("nl" as const),
      };
      const [body, subject] = await Promise.all([
        translateCorporateMailDraft({
          data: { mailboxId: activeId, text: compose.body, ...language },
        }),
        compose.subject.trim()
          ? translateCorporateMailDraft({
              data: { mailboxId: activeId, text: compose.subject, ...language },
            })
          : Promise.resolve({ translated: "" }),
      ]);
      return { body: body.translated, subject: subject.translated };
    },
    onSuccess: (result) => {
      setCompose((value) => ({
        ...value,
        subject: result.subject || value.subject,
        body: result.body,
        bodyHtml: plainTextToMailHtml(result.body),
      }));
      toast.success(text("Vertaalconcept toegevoegd.", "Translation draft added."));
    },
    onError: (error) =>
      toast.error(
        String(error).includes("TRANSLATION_NOT_CONFIGURED")
          ? text("De vertaalservice is nog niet ingesteld.", "The translation service is not configured yet.")
          : text("Vertaalconcept kon niet worden gemaakt.", "Translation draft could not be created."),
      ),
  });
  const retryOutbox = useMutation({
    mutationFn: (messageId: string) => retryCorporateMailDelivery({ data: { mailboxId: activeId, messageId } }),
    onSuccess: async () => {
      toast.success(text("Bericht opnieuw in de beveiligde wachtrij geplaatst.", "Message returned to the secure delivery queue."));
      setSelected(undefined);
      await refresh();
    },
    onError: () => toast.error(text("Alleen een mislukt bericht kan opnieuw worden geprobeerd.", "Only a failed message can be retried.")),
  });
  const items = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    let rows: any[] = [];
    if (folder === "inbox")
      rows = data.messages.filter((m: any) => m.direction === "inbound" && m.mail_folder !== "junk" && !m.archived_at);
    if (folder === "junk")
      rows = data.messages.filter((m: any) => m.direction === "inbound" && m.mail_folder === "junk" && !m.archived_at);
    if (folder === "sent")
      rows = data.messages.filter((m: any) => m.direction === "outbound" && !m.archived_at);
    if (folder === "archive") rows = data.messages.filter((m: any) => m.archived_at);
    if (folder === "outbox") rows = data.outbox;
    if (folder === "drafts") rows = data.drafts;
    const term = search.trim().toLowerCase();
    const filtered = term
      ? rows.filter((row: any) =>
          `${row.subject} ${row.sender_address || ""} ${(row.recipient_addresses || []).join(" ")} ${row.body_text || ""}`
            .toLowerCase()
            .includes(term),
        )
      : rows;
    if (!["inbox", "junk", "sent", "archive"].includes(folder)) return filtered;
    return groupMailThreads(filtered);
  }, [folder, query.data, search]);
  async function openMessage(item: any) {
    setSelected(item);
    if (!["inbox", "junk", "sent", "archive"].includes(folder)) return;
    const unread = messagesInThread(query.data?.messages || [], item)
      .filter((message: any) => message.direction === "inbound" && !message.read_at);
    if (!unread.length) return;
    try {
      await updateCorporateMailMessage({ data: {
        mailboxId: activeId, messageId: item.id,
        messageIds: unread.map((message: any) => message.id), action: "read",
      } });
      await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["notifications"] })]);
    } catch {
      toast.error(text("Leesstatus kon niet worden opgeslagen.", "Read status could not be saved."));
    }
  }
  async function messageAction(id: string, type: "read" | "unread" | "archive" | "restore") {
    await updateCorporateMailMessage({
      data: { mailboxId: activeId, messageId: id, action: type },
    });
    setSelected(undefined);
    await Promise.all([refresh(), qc.invalidateQueries({ queryKey: ["notifications"] })]);
  }
  function openDraft(draft: any) {
    setCompose({
      open: true,
      draftId: draft.id,
      to: draft.recipient_addresses.join(", "),
      cc: draft.cc_addresses.join(", "),
      subject: draft.subject,
      body: draft.body_text,
      bodyHtml: draft.body_html,
      replyToId: draft.in_reply_to_message_id || "",
      files: [],
    });
  }
  function reply(message: any) {
    setCompose({
      ...blank(true),
      to: message.sender_address,
      subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
      replyToId: message.id,
      files: [],
    });
  }
  if (query.data && !query.data.mailboxes.length)
    return (
      <Card>
        <CardContent className="p-6">
          {text(
            "Er is nog geen GlobeTrotr-mailbox aan jouw account gekoppeld.",
            "No GlobeTrotr mailbox has been assigned to your account yet.",
          )}
        </CardContent>
      </Card>
    );
  const folders: { id: Folder; label: string; icon: any }[] = [
    { id: "inbox", label: text("Inbox", "Inbox"), icon: Inbox },
    { id: "junk", label: text("Ongewenst", "Junk"), icon: ShieldAlert },
    { id: "sent", label: text("Verzonden", "Sent"), icon: Send },
    { id: "drafts", label: text("Concepten", "Drafts"), icon: FileText },
    { id: "outbox", label: text("Wachtrij", "Outbox"), icon: Mail },
    { id: "archive", label: text("Archief", "Archive"), icon: Archive },
  ];
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <Mail className="size-7 text-primary" />
            {text("Bedrijfsmail", "Company mail")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {text(
              "Lees, schrijf en beheer persoonlijke en gedeelde postvakken.",
              "Read, compose and manage personal and shared mailboxes.",
            )}
          </p>
        </div>
        <Button
          disabled={!activeId || query.data?.selected?.permission === "read"}
          onClick={() => setCompose(blank(true))}
        >
          <Send className="size-4" />
          {text("Nieuw bericht", "New message")}
        </Button>
      </header>
      <div className="flex flex-wrap gap-3">
        <select
          className="h-10 min-w-64 rounded-md border bg-background px-3"
          value={activeId}
          onChange={(e) => {
            setMailboxId(e.target.value);
            setArchiveLimit(25);
            setSelected(undefined);
            setCompose(blank());
          }}
        >
          {query.data?.mailboxes.map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.address} · {m.permission}
            </option>
          ))}
        </select>
        <label className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={text("Zoek in dit postvak…", "Search this mailbox…")}
          />
        </label>
      </div>
      {compose.open && query.data?.selected?.permission !== "read" && (
        <Composer
          mailboxId={activeId}
          compose={compose}
          setCompose={setCompose}
          text={text}
          saving={saveDraft.isPending}
          translating={translate.isPending}
          sending={send.isPending}
          onTranslate={(direction) => translate.mutate(direction)}
          onSend={() => send.mutate()}
          onClose={() => setCompose(blank())}
          onDeleted={refresh}
        />
      )}
      <div className="grid min-h-[32rem] min-w-0 gap-4 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {folders.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    size="sm"
                    variant={folder === item.id ? "default" : "ghost"}
                    onClick={() => {
                      setFolder(item.id);
                      if (item.id === "archive") setArchiveLimit(10);
                      setSelected(undefined);
                    }}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!items.length ? (
              <p className="text-sm text-muted-foreground">
                {text("Geen berichten gevonden.", "No messages found.")}
              </p>
            ) : (
              items.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-xl border p-3 text-left transition-colors hover:bg-muted/60 ${selected?.id === item.id ? "border-primary bg-primary/5" : item.unreadCount ? "bg-primary/5" : ""}`}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => (folder === "drafts" ? openDraft(item) : void openMessage(item))}
                >
                  <span className={`flex items-center gap-2 text-sm ${item.unreadCount ? "font-semibold" : "font-normal"}`}>
                    {item.unreadCount > 0 && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label={text("Ongelezen", "Unread")} />}
                    <span className="truncate">
                    {item.subject || text("Zonder onderwerp", "No subject")}
                    {item.threadCount > 1 ? ` (${item.threadCount})` : ""}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {folder === "inbox" || folder === "junk"
                      ? item.sender_address
                      : (item.recipient_addresses || []).join(", ")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.status ||
                      new Intl.DateTimeFormat(locale, {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(item.updated_at || item.received_at || item.created_at))}
                  </span>
                </button>
              ))
            )}
            {folder === "archive" && query.data?.archiveHasMore && (
              <Button className="w-full" variant="outline" onClick={() => setArchiveLimit((value) => Math.min(250, value + 10))}>
                {text("10 oudere berichten laden", "Load 10 older messages")}
              </Button>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="min-w-0 p-4 sm:p-6">
            {selected ? (
              <MessageDetail
                item={selected}
                thread={messagesInThread(query.data?.messages || [], selected)}
                mailboxId={activeId}
                folder={folder}
                text={text}
                canReply={query.data?.selected?.permission !== "read"}
                canDelete={query.data?.selected?.permission === "manage"}
                retrying={retryOutbox.isPending}
                onReply={() => reply(selected)}
                onRetry={() => retryOutbox.mutate(selected.id)}
                onArchive={() =>
                  void messageAction(selected.id, folder === "archive" ? "restore" : "archive")
                }
                onUnread={() => void messageAction(selected.id, "unread")}
                onDelete={async () => {
                  if (!window.confirm(text("Dit bericht en de bijlagen definitief verwijderen? Dit kan niet ongedaan worden gemaakt.", "Permanently delete this message and its attachments? This cannot be undone."))) return;
                  try {
                    await deleteCorporateMailMessage({ data: { mailboxId: activeId, messageId: selected.id } });
                    setSelected(undefined);
                    await refresh();
                    toast.success(text("Verwijdering aangevraagd. Het bericht blijft zichtbaar totdat bron en bijlagen zijn verwijderd.", "Deletion requested. The message remains visible until its source and attachments have been removed."));
                  } catch {
                    toast.error(text("Bericht kon niet worden verwijderd.", "Message could not be deleted."));
                  }
                }}
                onDownload={async (attachment: any) => {
                  const result = await getCorporateMailAttachmentUrl({
                    data: { mailboxId: activeId, attachmentId: attachment.id },
                  });
                  window.location.assign(result.url);
                }}
              />
            ) : (
              <p className="text-muted-foreground">
                {text("Selecteer een bericht of concept.", "Select a message or draft.")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Composer({
  mailboxId,
  compose,
  setCompose,
  text,
  saving,
  translating,
  sending,
  onTranslate,
  onSend,
  onClose,
  onDeleted,
}: {
  mailboxId: string;
  compose: Compose;
  setCompose: (value: Compose | ((value: Compose) => Compose)) => void;
  text: (nl: string, en: string) => string;
  saving: boolean;
  translating: boolean;
  sending: boolean;
  onTranslate: (direction: "nl-en" | "en-nl") => void;
  onSend: () => void;
  onClose: () => void;
  onDeleted: () => Promise<unknown>;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>
            {compose.replyToId
              ? text("Beantwoorden", "Reply")
              : text("Nieuw bericht", "New message")}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {saving
              ? text("Concept opslaan…", "Saving draft…")
              : compose.draftId
                ? text("Concept opgeslagen", "Draft saved")
                : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Aan / To" value={compose.to} set={(to) => setCompose({ ...compose, to })} />
        <Field label="CC" value={compose.cc} set={(cc) => setCompose({ ...compose, cc })} />
        <Field
          label={text("Onderwerp", "Subject")}
          value={compose.subject}
          set={(subject) => setCompose({ ...compose, subject })}
        />
        <div className="space-y-2">
          <Label>{text("Bericht", "Message")}</Label>
          <RichMailEditor
            html={compose.bodyHtml}
            label={text("Bericht opmaken", "Format message")}
            linkPrompt={text(
              "Welke veilige link wil je toevoegen?",
              "Which safe link would you like to add?",
            )}
            onChange={(bodyHtml, body) => setCompose((value) => ({ ...value, bodyHtml, body }))}
          />
        </div>
        <div className="space-y-2">
          <Label>{text("Bijlagen", "Attachments")}</Label>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
            <Paperclip className="size-4" />
            {text("Bestanden kiezen", "Choose files")}
            <input
              className="sr-only"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx"
              onChange={(event) => {
                const next = [...compose.files, ...Array.from(event.target.files || [])].slice(0, 5);
                if (
                  next.some((file) => file.size > 10 * 1024 * 1024) ||
                  next.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024
                ) {
                  toast.error(
                    text(
                      "Maximaal 5 bestanden, 10 MB per bestand en 20 MB totaal.",
                      "Up to 5 files, 10 MB per file and 20 MB total.",
                    ),
                  );
                } else setCompose({ ...compose, files: next });
                event.currentTarget.value = "";
              }}
            />
          </label>
          {compose.files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="min-w-0 truncate">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCompose({ ...compose, files: compose.files.filter((_, itemIndex) => itemIndex !== index) })}>
                {text("Verwijderen", "Remove")}
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={translating || compose.body.trim().length < 2 || compose.body.length > 30000}
            onClick={() => onTranslate("nl-en")}
          >
            <Languages className="size-4" />
            NL → EN
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={translating || compose.body.trim().length < 2 || compose.body.length > 30000}
            onClick={() => onTranslate("en-nl")}
          >
            <Languages className="size-4" />
            EN → NL
          </Button>
          <Button type="button" variant="outline" onClick={() => setPreview((value) => !value)}>
            {preview
              ? text("Voorbeeld sluiten", "Close preview")
              : text("HTML-voorbeeld", "HTML preview")}
          </Button>
        </div>
        {preview && (
          <iframe
            title={text("Voorbeeld van e-mail", "Email preview")}
            sandbox=""
            className="h-72 w-full rounded-lg border bg-white"
            srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><div style="font:16px/1.6 Arial;padding:24px">${compose.bodyHtml}</div>`}
          />
        )}
        <p className="text-xs text-muted-foreground">
          {text(
            "Vertalingen zijn concepten: controleer namen, bedragen en betekenis altijd voor verzending.",
            "Translations are drafts: always review names, amounts and meaning before sending.",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              sending || !compose.to.trim() || !compose.subject.trim() || !compose.body.trim()
            }
            onClick={onSend}
          >
            <Send className="size-4" />
            {text("Klaarzetten", "Queue")}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {text("Sluiten", "Close")}
          </Button>
          {compose.draftId && (
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                await deleteCorporateMailDraft({ data: { mailboxId, id: compose.draftId } });
                await onDeleted();
                onClose();
              }}
            >
              <Trash2 className="size-4" />
              {text("Concept verwijderen", "Delete draft")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MessageDetail({
  item,
  thread,
  mailboxId,
  folder,
  text,
  canReply,
  canDelete,
  retrying,
  onReply,
  onRetry,
  onArchive,
  onUnread,
  onDelete,
  onDownload,
}: {
  item: any;
  thread: any[];
  mailboxId: string;
  folder: Folder;
  text: (nl: string, en: string) => string;
  canReply: boolean;
  canDelete: boolean;
  retrying: boolean;
  onReply: () => void;
  onRetry: () => void;
  onArchive: () => void;
  onUnread: () => void;
  onDelete: () => void;
  onDownload: (attachment: any) => Promise<void>;
}) {
  const messages = thread.length ? thread : [item];
  const [translations, setTranslations] = useState<Record<string, { language: "nl" | "en"; body: string; html: boolean }>>({});
  const [remoteImages, setRemoteImages] = useState<Record<string, boolean>>({});
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [translating, setTranslating] = useState("");
  const translationLength = (message: any) => String(message.body_html || message.body_text || message.preview_text || "").trim().length;
  async function translateMessage(message: any, target: "nl" | "en") {
    const html = String(message.body_html || "").trim();
    const value = (html ? mailHtmlForDisplay(html, message.body_text) : String(message.body_text || message.preview_text || "")).trim();
    if (value.length < 2 || value.length > 30000) return;
    setTranslating(`${message.id}:${target}`);
    try {
      const result = await translateCorporateMailDraft({ data: {
        mailboxId,
        text: value,
        source: "auto",
        target,
        format: html ? "html" : "text",
      } });
      setTranslations((current) => ({ ...current, [message.id]: { language: target, body: result.translated, html: Boolean(html) } }));
    } catch (error) {
      toast.error(String(error).includes("TRANSLATION_NOT_CONFIGURED")
        ? text("De vertaalprovider is nog niet ingesteld.", "The translation provider is not configured yet.")
        : text("Vertalen is tijdelijk mislukt. De taal wordt automatisch herkend; controleer of de vertaalservice op Node-02 bereikbaar is.", "Translation temporarily failed. Language is detected automatically; check whether the translation service on Node-02 is reachable."));
    } finally {
      setTranslating("");
    }
  }
  return (
    <article className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-0 break-words font-display text-2xl font-semibold">
          {item.subject || text("Zonder onderwerp", "No subject")}
        </h2>
        <Badge variant="outline">{item.status || item.direction}</Badge>
        {messages.length > 1 && (
          <Badge variant="secondary">
            {messages.length} {text("berichten", "messages")}
          </Badge>
        )}
      </div>
      {folder === "outbox" && item.status === "failed" && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
        <strong>{text("Bezorging mislukt", "Delivery failed")}</strong>
        <p className="mt-1 break-all text-xs text-muted-foreground">{text("Pogingen", "Attempts")}: {item.attempts ?? 0}{item.last_error_code ? ` · ${item.last_error_code}` : ""}</p>
        <p className="mt-1 text-xs text-muted-foreground">{text("Controleer adres en mailconfiguratie voordat je opnieuw probeert.", "Check the address and mail configuration before retrying.")}</p>
      </div>}
      {messages.map((message, index) => (
        <section key={message.id} className="min-w-0 max-w-full overflow-hidden rounded-xl border p-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span className="min-w-0 break-all font-medium">
              {message.sender_address || text("Uitgaand bericht", "Outgoing message")}
            </span>
            {message.received_at && (
              <time className="text-muted-foreground">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(message.received_at))}
              </time>
            )}
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {(message.recipient_addresses || []).join(", ")}
          </p>
          {canDelete && <div className="mt-3 space-y-2 rounded-lg border p-3 text-xs">
            <p>{message.retention_hold ? text("Bewaarpauze actief", "Retention hold active") : message.retention_reviewed ? text("Gewone mail: verwijderen na zes maanden", "Ordinary email: delete after six months") : text("Nog niet beoordeeld voor opschoning", "Not yet reviewed for cleanup")}</p>
            {message.retention_hold && <p>{message.retention_hold_reason} · {message.retention_review_at}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                if (!window.confirm(text("Als gewone mail markeren? Vanaf zes maanden oud mag dit bericht automatisch worden verwijderd.", "Mark as ordinary email? Once six months old, this message may be deleted automatically."))) return;
                try { await setCorporateMailRetention({ data: { mailboxId, messageId: message.id, hold: false } }); window.dispatchEvent(new Event("corporate-mail-retention-changed")); toast.success(text("Bewaarbeleid opgeslagen", "Retention saved")); }
                catch { toast.error(text("Bewaarbeleid kon niet worden gewijzigd", "Could not change retention")); }
              }}>{text("Gewone mail", "Ordinary email")}</Button>
              <Button size="sm" variant="outline" onClick={async () => {
                const reason = window.prompt(text("Reden om langer te bewaren (factuur, geschil of wettelijke plicht):", "Reason to retain longer (invoice, dispute or legal duty):"));
                if (!reason || reason.trim().length < 5) return;
                const date = window.prompt(text("Datum voor herbeoordeling (YYYY-MM-DD):", "Review date (YYYY-MM-DD):"));
                if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || Date.parse(date) <= Date.now()) return;
                try { await setCorporateMailRetention({ data: { mailboxId, messageId: message.id, hold: true, reason, reviewAt: new Date(date).toISOString() } }); window.dispatchEvent(new Event("corporate-mail-retention-changed")); toast.success(text("Bewaarpauze opgeslagen", "Retention hold saved")); }
                catch { toast.error(text("Bewaarpauze kon niet worden opgeslagen", "Could not save retention hold")); }
              }}>{text("Bewaarpauze", "Retention hold")}</Button>
            </div>
          </div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={Boolean(translating) || translationLength(message) < 2 || translationLength(message) > 30000} onClick={() => void translateMessage(message, "nl")}>
              {translating === `${message.id}:nl` ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
              {text("Lees in Nederlands", "Read in Dutch")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={Boolean(translating) || translationLength(message) < 2 || translationLength(message) > 30000} onClick={() => void translateMessage(message, "en")}>
              {translating === `${message.id}:en` ? <Loader2 className="size-4 animate-spin" /> : <Languages className="size-4" />}
              {text("Lees in Engels", "Read in English")}
            </Button>
          </div>
          {translations[message.id] && <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2"><Badge variant="secondary">{translations[message.id].language.toUpperCase()} {text("concept", "draft")}</Badge><Button size="sm" variant="ghost" onClick={() => setTranslations((current) => { const next = { ...current }; delete next[message.id]; return next; })}>{text("Sluiten", "Close")}</Button></div>
            {translations[message.id].html ? <iframe title={text("Vertaalde HTML-mail", "Translated HTML email")} sandbox="" referrerPolicy="no-referrer" className="mt-2 h-[45vh] min-h-[20rem] w-full rounded-lg border bg-white" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><style>html,body{max-width:100%;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style>${translations[message.id].body}`} /> : <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{translations[message.id].body}</p>}
          </div>}
          {message.body_html || message.body_text ? (
            <HtmlMailFrame
              message={message}
              mailboxId={mailboxId}
              index={index}
              text={text}
              remoteImages={Boolean(remoteImages[message.id])}
              expanded={Boolean(expandedMessages[message.id])}
              onLoadRemote={() => setRemoteImages((current) => ({ ...current, [message.id]: true }))}
              onToggleSize={() => setExpandedMessages((current) => ({ ...current, [message.id]: !current[message.id] }))}
            />
          ) : (
            <p className="mt-4 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {message.body_text ||
                message.preview_text ||
                text("Inhoud staat klaar voor verwerking.", "Content is queued for processing.")}
            </p>
          )}
          {message.attachments?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.attachments.map((attachment: any) => (
                <Button key={attachment.id} type="button" size="sm" variant="outline" onClick={() => void onDownload(attachment)}>
                  <Download className="size-4" />
                  <span className="max-w-52 truncate">{attachment.file_name}</span>
                </Button>
              ))}
            </div>
          )}
        </section>
      ))}
      <div className="mt-6 flex gap-2">
        {["inbox", "junk", "archive"].includes(folder) && item.direction === "inbound" && <Button variant="outline" onClick={onUnread}><MailOpen className="size-4" />{text("Markeren als ongelezen", "Mark as unread")}</Button>}
        {folder === "inbox" && (
          <Button disabled={!canReply} onClick={onReply}>
            <Reply className="size-4" />
            {text("Beantwoorden", "Reply")}
          </Button>
        )}
        {folder === "outbox" && item.status === "failed" && (
          <Button disabled={retrying || !canReply} onClick={onRetry}>
            <RotateCcw className={`size-4 ${retrying ? "animate-spin" : ""}`} />
            {text("Opnieuw proberen", "Retry delivery")}
          </Button>
        )}
        {["inbox", "junk", "sent", "archive"].includes(folder) && (
          <Button variant="outline" onClick={onArchive}>
            <Archive className="size-4" />
            {folder === "archive" ? text("Herstellen", "Restore") : text("Archiveren", "Archive")}
          </Button>
        )}
        {folder === "archive" && canDelete && (
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="size-4" />
            {text("Definitief verwijderen", "Delete permanently")}
          </Button>
        )}
      </div>
    </article>
  );
}
function HtmlMailFrame({ message, mailboxId, index, text, remoteImages, expanded, onLoadRemote, onToggleSize }: {
  message: any;
  mailboxId: string;
  index: number;
  text: (nl: string, en: string) => string;
  remoteImages: boolean;
  expanded: boolean;
  onLoadRemote: () => void;
  onToggleSize: () => void;
}) {
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onToggleSize(); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [expanded, onToggleSize]);
  const displayHtml = mailHtmlForDisplay(message.body_html, message.body_text);
  const hasCid = /<img\b[^>]*\bsrc\s*=\s*["']cid:/i.test(displayHtml);
  const inline = useQuery({
    queryKey: ["corporate-mail-inline-images", mailboxId, message.id],
    queryFn: () => getCorporateMailInlineImages({ data: { mailboxId, messageId: message.id } }),
    enabled: hasCid && message.direction === "inbound",
    staleTime: 30_000,
    gcTime: 60_000,
  });
  const images = inline.data?.images ?? [];
  const html = resolveInlineMailImages(displayHtml, images);
  const imageOrigins = [...new Set(images.map((image) => {
    try { const url = new URL(image.url); return url.protocol === "https:" ? url.origin : ""; } catch { return ""; }
  }).filter(Boolean))].join(" ");
  const hasExternal = /<img\b[^>]*\bsrc\s*=\s*["']https?:/i.test(displayHtml);
  return <div className={expanded ? "fixed inset-2 z-50 flex min-h-0 flex-col gap-2 rounded-xl border bg-background p-3 shadow-2xl sm:inset-6" : "mt-4 space-y-2"}>
    <div className="flex flex-wrap items-center gap-2">
      {hasExternal && !remoteImages && <Button type="button" size="sm" variant="outline" onClick={onLoadRemote}>
        {text("Externe afbeeldingen laden", "Load external images")}
      </Button>}
      <Button type="button" size="sm" variant="outline" onClick={onToggleSize}>
        {expanded ? text("Normaal formaat", "Normal size") : text("Groter leesvenster", "Larger reading area")}
      </Button>
    </div>
    {hasExternal && !remoteImages && <p className="text-xs text-muted-foreground">{text("Externe afbeeldingen zijn geblokkeerd. Laden kan je IP-adres aan de afzender tonen; meegestuurde afbeeldingen worden automatisch getoond.", "External images are blocked. Loading them may reveal your IP address to the sender; attached inline images appear automatically.")}</p>}
    {hasCid && inline.isError && <p className="text-xs text-destructive">{text("Meegestuurde afbeeldingen konden niet worden geladen.", "Attached inline images could not be loaded.")}</p>}
    <iframe
      title={`${text("HTML-bericht", "HTML message")} ${index + 1}`}
      sandbox=""
      referrerPolicy="no-referrer"
      className={`block w-full max-w-full rounded-lg border bg-white ${expanded ? "min-h-0 flex-1" : "h-[55vh] min-h-[24rem]"}`}
      srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: ${imageOrigins}${remoteImages ? " https:" : ""}; base-uri 'none'; form-action 'none'"><style>html,body{max-width:100%;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style>${html}`}
    />
  </div>;
}
function Field({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function split(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
