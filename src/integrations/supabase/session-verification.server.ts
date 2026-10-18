import type { SupabaseClient } from "@supabase/supabase-js";

type SessionClient = { auth: Pick<SupabaseClient["auth"], "getClaims" | "getUser"> };

/** JWT verification alone cannot reflect account bans or revoked sessions. */
export async function requireActiveSupabaseSession(client: SessionClient, token: string) {
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

  // Ask Auth before a service_role handler runs. Auth verifies that the user
  // and session still exist and rejects users banned after this JWT was issued.
  const { data: identity, error: identityError } = await client.auth.getUser(token);
  if (identityError || !identity.user || identity.user.id !== data.claims.sub) {
    throw new Error("Unauthorized: Account or session is no longer active");
  }
  return data.claims;
}
