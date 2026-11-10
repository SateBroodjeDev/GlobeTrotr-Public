export const ISSUE_CATEGORIES = ["bug", "improvement", "idea", "usability", "translation", "security", "other"] as const;
export type IssueCategory = typeof ISSUE_CATEGORIES[number];
export function issueCategoryLabel(category: string, text: (nl: string, en: string) => string) {
  const labels: Record<string, [string, string]> = { bug:["Fout","Bug"], improvement:["Verbetering","Improvement"], idea:["Idee","Idea"], usability:["Gebruiksgemak","Usability"], translation:["Vertaling","Translation"], security:["Beveiliging","Security"], other:["Overig","Other"] };
  const label=labels[category]??labels.other!;
  return text(label[0],label[1]);
}
