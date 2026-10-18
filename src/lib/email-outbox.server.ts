import { mailLocale } from "./mail-locale.ts";
type AdminDb = { from: (table: string) => any };

export async function queueInvitationEmail(
  db: AdminDb,
  input: {
    recipient: string;
    locale?: string;
    title: string;
    body: string;
    actionUrl: string;
    preferenceUserId?: string;
    invitationType: "trip" | "agency" | "client_form";
    invitationId: string;
    branding?: {
      brandName: string;
      accentHue: number;
      workspaceId?: string;
      portalHost?: string;
      tagline?: string;
      logoPath?: string | null;
      contactEmail?: string;
    };
  },
): Promise<"queued" | "skipped" | "failed"> {
  if (input.preferenceUserId) {
    const { data: profile, error: preferenceError } = await db
      .from("profiles")
      .select("notification_preferences")
      .eq("id", input.preferenceUserId)
      .maybeSingle();
    if (preferenceError || !profile) return "failed";
    if (profile?.notification_preferences?.invitations === false) return "skipped";
  }
  const { data: config, error: configError } = await db
    .from("email_delivery_config")
    .select("mode")
    .eq("id", true)
    .single();
  if (configError) {
    console.error("[Invitation email] Delivery configuration unavailable.", {
      code: configError.code,
    });
    return "failed";
  }
  const { error } = await db.from("email_outbox").upsert(
    {
      notification_id: null,
      user_id: input.preferenceUserId ?? null,
      recipient_email: input.recipient,
      locale: mailLocale(input.locale),
      template_key: "invitation",
      payload: {
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl,
        ...(input.branding ? { branding: input.branding } : {}),
      },
      invitation_type: input.invitationType,
      invitation_id: input.invitationId,
      status: config.mode === "live" ? "pending" : "held",
    },
    { onConflict: "invitation_type,invitation_id,invitation_action_url", ignoreDuplicates: true },
  );
  if (error) {
    console.error("[Invitation email] Could not queue message.", { code: error.code });
    return "failed";
  }
  return "queued";
}
