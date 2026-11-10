import { ISSUE_CATEGORIES, type IssueCategory } from "./issue-categories.ts";

export type DevelopmentInput = {
  id?: string; titleNl: string; titleEn: string; descriptionNl: string; descriptionEn: string;
  status: "investigating" | "planned" | "monitoring" | "resolved";
  severity: "low" | "medium" | "high" | "critical"; category: IssueCategory;
};
export function validateDevelopmentInput(input: DevelopmentInput): DevelopmentInput {
  const bounded = (value: unknown, max: number) => typeof value === "string" && value.trim().length >= 3 && value.trim().length <= max;
  if (!input || !bounded(input.titleNl,160) || !bounded(input.titleEn,160)
    || !bounded(input.descriptionNl,2000) || !bounded(input.descriptionEn,2000)
    || !["investigating","planned","monitoring","resolved"].includes(input.status)
    || !["low","medium","high","critical"].includes(input.severity)
    || !(ISSUE_CATEGORIES as readonly string[]).includes(input.category)
    || (input.id !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.id)))
    throw new Error("INVALID_DEVELOPMENT_INPUT");
  return { id: input.id, titleNl: input.titleNl.trim(), titleEn: input.titleEn.trim(),
    descriptionNl: input.descriptionNl.trim(), descriptionEn: input.descriptionEn.trim(),
    status: input.status, severity: input.severity, category: input.category };
}

export function developmentStats(rows: { archived_at?: string | null; status: string; github_issue_number?: number | null }[]) {
  const active = rows.filter(row => !row.archived_at);
  return {
    open: active.filter(row => row.status !== "resolved").length,
    resolved: active.filter(row => row.status === "resolved").length,
    linked: active.filter(row => Boolean(row.github_issue_number)).length,
    unlinked: active.filter(row => !row.github_issue_number).length,
    archived: rows.length - active.length,
  };
}
