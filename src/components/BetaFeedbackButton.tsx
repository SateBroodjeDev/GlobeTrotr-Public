import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/lib/locale";
import { ISSUE_CATEGORIES, issueCategoryLabel, type IssueCategory } from "@/lib/issue-categories";

export function BetaFeedbackButton() {
  const { user } = useAuth();
  const { text } = useLocale();
  const corporateAdmin = useRouterState({ select: (state) => state.location.pathname.startsWith("/corporate-admin") });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<IssueCategory>("bug");
  const [sending, setSending] = useState(false);
  if (!user || corporateAdmin) return null;

  async function submit() {
    if (title.trim().length < 3 || description.trim().length < 10) {
      toast.error(text("Beschrijf kort wat er gebeurde.", "Briefly describe what happened."));
      return;
    }
    setSending(true);
    const { error } = await supabase.from("beta_feedback").insert({
      user_id: user!.id,
      title: title.trim(),
      description: description.trim(),
      category,
      page_url: window.location.pathname,
      browser_info: navigator.userAgent.slice(0, 500),
    } as never);
    setSending(false);
    if (error) {
      toast.error(text("Feedback kon niet worden verzonden.", "Feedback could not be sent."));
      return;
    }
    setTitle(""); setDescription(""); setOpen(false);
    toast.success(text("Bedankt! Je feedback is ontvangen.", "Thank you! Your feedback was received."));
  }

  return <>
    <Button type="button" size="icon" className="fixed right-0 top-1/2 z-40 -translate-y-1/2 rounded-r-none rounded-l-xl shadow-lg" onClick={() => setOpen(true)} aria-label={text("Feedback indienen", "Submit feedback")} title={text("Feedback indienen", "Submit feedback")}>
      <MessageSquarePlus className="size-5" />
    </Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{text("Feedback voor GlobeTrotr", "Feedback for GlobeTrotr")}</DialogTitle><DialogDescription>{text("Meld een probleem of deel een idee. De huidige pagina en technische browserinformatie worden meegestuurd.", "Report a problem or share an idea. The current page and technical browser information are included.")}</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <label className="space-y-1.5"><Label htmlFor="feedback-category">{text("Categorie", "Category")}</Label><select id="feedback-category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={category} onChange={e=>setCategory(e.target.value as IssueCategory)}>{ISSUE_CATEGORIES.map(value=><option key={value} value={value}>{issueCategoryLabel(value,text)}</option>)}</select></label>
        <label className="space-y-1.5"><Label htmlFor="feedback-title">{text("Onderwerp", "Subject")}</Label><Input id="feedback-title" maxLength={120} value={title} onChange={e=>setTitle(e.target.value)} /></label>
        <label className="space-y-1.5"><Label htmlFor="feedback-description">{text("Wat gebeurde er of wat kan beter?", "What happened or could be improved?")}</Label><Textarea id="feedback-description" rows={6} maxLength={3000} value={description} onChange={e=>setDescription(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">{text("Plaats geen wachtwoorden, betaalgegevens, paspoortgegevens of medische informatie in je melding.", "Do not include passwords, payment details, passport data or medical information.")}</p>
        <Button className="w-full" disabled={sending} onClick={() => void submit()}>{sending ? text("Verzenden…", "Sending…") : text("Feedback verzenden", "Send feedback")}</Button>
      </div>
    </DialogContent></Dialog>
  </>;
}
