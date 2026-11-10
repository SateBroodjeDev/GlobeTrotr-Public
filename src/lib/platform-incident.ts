export type PlatformIncidentPhase = "investigating" | "identified" | "monitoring" | "resolved";
export type PlatformAnnouncementInput = {
  requestId: string;
  expectedLatestId: string | null;
  type: "status" | "update";
  severity: "info" | "warning" | "critical" | "resolved";
  titleNl: string; titleEn: string; bodyNl: string; bodyEn: string;
  statusKey?: string;
  publicStatus: boolean;
  componentKeys: string[];
  phase: PlatformIncidentPhase;
};

export function validatePlatformAnnouncementInput(input: PlatformAnnouncementInput): PlatformAnnouncementInput {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!input || !uuid.test(input.requestId) || !(input.expectedLatestId === null || uuid.test(input.expectedLatestId)) ||
    (input.statusKey !== undefined && !uuid.test(input.statusKey)) ||
    !["status", "update"].includes(input.type) || !["info", "warning", "critical", "resolved"].includes(input.severity) ||
    typeof input.publicStatus !== "boolean" || !Array.isArray(input.componentKeys) ||
    (input.type === "update" && (input.publicStatus || input.severity === "resolved" || input.statusKey)))
    throw new Error("INVALID_ANNOUNCEMENT");
  if (input.publicStatus && (!input.componentKeys.length || input.componentKeys.length > 30 ||
    new Set(input.componentKeys).size !== input.componentKeys.length ||
    input.componentKeys.some(key => typeof key !== "string" || !/^[a-z][a-z0-9_-]{1,39}$/.test(key)) ||
    !["investigating", "identified", "monitoring", "resolved"].includes(input.phase) || input.severity === "info" ||
    (input.severity === "resolved") !== (input.phase === "resolved"))) throw new Error("INVALID_PUBLIC_STATUS");
  for (const [value, max] of [[input.titleNl, 120], [input.titleEn, 120], [input.bodyNl, 1000], [input.bodyEn, 1000]] as const) {
    if (typeof value !== "string" || [...value.trim()].length < 3 || [...value.trim()].length > max)
      throw new Error("INVALID_ANNOUNCEMENT");
  }
  return { ...input, titleNl: input.titleNl.trim(), titleEn: input.titleEn.trim(), bodyNl: input.bodyNl.trim(), bodyEn: input.bodyEn.trim() };
}

type PublishedAnnouncement = {
  id: string; announcement_type: string; severity: string; status_key: string | null;
  title_nl: string; title_en: string; body_nl: string; body_en: string;
  public_status: boolean; component_keys: string[]; incident_phase: string | null;
};

export function announcementFollowUpText(
  source: { title_nl: string; title_en: string; body_nl: string; body_en: string }, resolved: boolean,
) {
  const bounded = (value: string, maximum: number) => [...value].slice(0, maximum).join("");
  return {
    titleNl: bounded(`${resolved ? "Opgelost" : "Update"}: ${source.title_nl}`, 120),
    titleEn: bounded(`${resolved ? "Resolved" : "Update"}: ${source.title_en}`, 120),
    bodyNl: bounded(resolved ? `Dit incident is afgesloten. Raadpleeg het dienstenoverzicht voor de actuele beschikbaarheid.\n\n${source.body_nl}` : source.body_nl, 1000),
    bodyEn: bounded(resolved ? `This incident is closed. Please refer to the service overview for current availability.\n\n${source.body_en}` : source.body_en, 1000),
  };
}

/** A lost HTTP response is success only when a fresh read confirms this payload. */
export function announcementPublicationSaved(input: PlatformAnnouncementInput, rows: PublishedAnnouncement[]): boolean {
  return rows.some(row => row.id === input.requestId && row.announcement_type === input.type && row.severity === input.severity &&
    row.status_key === (input.type === "status" ? input.statusKey ?? input.requestId : null) && row.public_status === input.publicStatus &&
    row.title_nl === input.titleNl.trim() && row.title_en === input.titleEn.trim() &&
    row.body_nl === input.bodyNl.trim() && row.body_en === input.bodyEn.trim() &&
    (!input.publicStatus || row.incident_phase === input.phase &&
      JSON.stringify([...row.component_keys].sort()) === JSON.stringify([...input.componentKeys].sort())));
}

export function measuredIncidentCovered(
  incident: { id: string; key: string; startedAt?: string },
  notices: { current?: boolean; public_status?: boolean; status_key?: string; severity?: string; component_keys?: string[]; published_at?: string }[],
): boolean {
  return notices.some(notice => {
    if (!notice.current || !notice.public_status) return false;
    if (notice.status_key === incident.id) return true;
    if (!notice.component_keys?.includes(incident.key)) return false;
    if (notice.severity !== "resolved") return true;
    const started = Date.parse(incident.startedAt ?? "");
    const closed = Date.parse(notice.published_at ?? "");
    return Number.isFinite(started) && Number.isFinite(closed) && started <= closed;
  });
}
