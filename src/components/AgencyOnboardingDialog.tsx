import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronLeft, ChevronRight, Globe2, MailCheck, Palette, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { completeAgencyOnboarding, getAgencySettings, saveAgencySettings, type AgencySettings } from "@/lib/agency.functions";
import { getAgencyDeliverySettings, saveAgencyDeliverySettings, testAgencySmtp, verifyAgencyDomain, type AgencyDeliverySettings } from "@/lib/agency-delivery.functions";
import { useLocale } from "@/lib/locale";
import { useWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

const steps = [Building2, Palette, Globe2, Send, ShieldCheck];

export function AgencyOnboardingDialog({ enabled }: { enabled: boolean }) {
  const { text } = useLocale();
  const { refreshWorkspace } = useWorkspace();
  const settingsQuery = useQuery({ queryKey: ["agency-settings"], queryFn: () => getAgencySettings(), enabled, retry: false });
  const deliveryQuery = useQuery({ queryKey: ["agency-delivery"], queryFn: () => getAgencyDeliverySettings(), enabled, retry: false });
  const [settings, setSettings] = useState<AgencySettings | null>(null);
  const [delivery, setDelivery] = useState<AgencyDeliverySettings | null>(null);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [logoFile, setLogoFile] = useState<File>();
  const [turnstileConfirmed, setTurnstileConfirmed] = useState(false);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => { if (settingsQuery.data) setSettings(settingsQuery.data); }, [settingsQuery.data]);
  useEffect(() => { if (deliveryQuery.data) { setDelivery(deliveryQuery.data); setTurnstileConfirmed(deliveryQuery.data.turnstileConfigured); } }, [deliveryQuery.data]);
  useEffect(() => {
    if (enabled && settingsQuery.data && deliveryQuery.data && !settingsQuery.data.onboardingCompletedAt) setOpen(true);
  }, [enabled, settingsQuery.data, deliveryQuery.data]);

  if (!settings || !delivery || settings.onboardingCompletedAt) return null;
  const setSetting = <K extends keyof AgencySettings>(key: K, value: AgencySettings[K]) => setSettings((current) => current ? { ...current, [key]: value } : current);
  const setDeliveryValue = <K extends keyof AgencyDeliverySettings>(key: K, value: AgencyDeliverySettings[K]) => setDelivery((current) => current ? { ...current, [key]: value } : current);

  async function saveBranding() {
    setBusy("branding");
    let uploadedPath = "";
    try {
      let nextSettings = settings!;
      if (logoFile) {
        const extension = logoFile.type === "image/png" ? "png" : logoFile.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${settings!.workspaceId}/logo-${Date.now()}.${extension}`;
        const uploaded = await supabase.storage.from("agency-logos").upload(uploadedPath, logoFile, { contentType: logoFile.type });
        if (uploaded.error) throw uploaded.error;
        nextSettings = { ...settings!, logoPath: uploadedPath };
      }
      const { workspaceId: _workspaceId, onboardingCompletedAt: _onboarding, ...values } = nextSettings;
      await saveAgencySettings({ data: values });
      if (uploadedPath && settings!.logoPath) await supabase.storage.from("agency-logos").remove([settings!.logoPath]);
      setSettings(nextSettings);
      setLogoFile(undefined);
      await Promise.all([settingsQuery.refetch(), refreshWorkspace()]);
      toast.success(text("Organisatie en huisstijl opgeslagen.", "Organisation and branding saved."));
      setStep(2);
    } catch { if (uploadedPath) await supabase.storage.from("agency-logos").remove([uploadedPath]); toast.error(text("Controleer de organisatiegegevens.", "Check the organisation details.")); }
    finally { setBusy(""); }
  }

  async function uploadLogo(file?: File) {
    if (!file || file.size > 2 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error(text("Gebruik PNG, JPG of WebP van maximaal 2 MB.", "Use PNG, JPG or WebP up to 2 MB."));
      return;
    }
    setLogoFile(file);
    toast.success(text("Logo klaar om samen met de huisstijl op te slaan.", "Logo ready to save with the branding."));
  }

  async function saveDelivery() {
    setBusy("delivery");
    try {
      await saveAgencyDeliverySettings({ data: {
        subdomain: delivery!.subdomain,
        customDomain: delivery!.customDomain,
        fromName: delivery!.fromName,
        fromEmail: delivery!.fromEmail,
        replyTo: delivery!.replyTo,
        smtpHost: delivery!.smtpHost,
        smtpPort: delivery!.smtpPort,
        smtpSecure: delivery!.smtpSecure,
        smtpUsername: delivery!.smtpUsername,
        smtpPassword,
        turnstileConfigured: turnstileConfirmed,
      } });
      setSmtpPassword("");
      const refreshed = await deliveryQuery.refetch();
      if (refreshed.data) setDelivery(refreshed.data);
      toast.success(text("Domein en e-mailinstellingen opgeslagen.", "Domain and email settings saved."));
      setStep(4);
    } catch { toast.error(text("Domein of e-mailinstellingen zijn nog niet geldig.", "Domain or email settings are not valid yet.")); }
    finally { setBusy(""); }
  }

  async function verifyDomain() {
    setBusy("domain");
    try {
      const result = await verifyAgencyDomain();
      await deliveryQuery.refetch();
      toast[result.verified ? "success" : "error"](result.verified
        ? text("DNS en eigendom zijn geverifieerd.", "DNS and ownership are verified.")
        : text("DNS is nog niet compleet. Controleer CNAME en TXT.", "DNS is not complete yet. Check CNAME and TXT."));
    } catch { toast.error(text("DNS-controle is mislukt.", "DNS verification failed.")); }
    finally { setBusy(""); }
  }

  async function testSmtp() {
    setBusy("smtp");
    try { await testAgencySmtp(); await deliveryQuery.refetch(); toast.success(text("Testmail verzonden en SMTP werkt.", "Test email sent and SMTP works.")); }
    catch { await deliveryQuery.refetch(); toast.error(text("SMTP-test mislukt. Controleer host, poort, TLS en wachtwoord.", "SMTP test failed. Check host, port, TLS and password.")); }
    finally { setBusy(""); }
  }

  async function finish() {
    if (delivery!.customDomain && (delivery!.domainStatus !== "verified" || !turnstileConfirmed)) {
      toast.error(text("Rond eerst DNS en Turnstile voor het eigen domein af.", "Complete DNS and Turnstile for the custom domain first."));
      return;
    }
    if (delivery!.smtpConfigured && delivery!.smtpTestStatus !== "ok") {
      toast.error(text("Test eerst de ingestelde SMTP-verbinding.", "Test the configured SMTP connection first."));
      return;
    }
    setBusy("finish");
    try {
      await completeAgencyOnboarding();
      await settingsQuery.refetch();
      setOpen(false);
      toast.success(text("Je Agency-portal is klaar voor gebruik.", "Your Agency portal is ready to use."));
    } catch { toast.error(text("Onboarding kon niet worden afgerond.", "Onboarding could not be completed.")); }
    finally { setBusy(""); }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl" onInteractOutside={(event) => event.preventDefault()}>
    <DialogHeader><DialogTitle>{text("Maak je Agency-portal klaar", "Set up your Agency portal")}</DialogTitle><DialogDescription>{text("Stel je merk, domein en e-mail stap voor stap in. Je kunt later alles wijzigen onder Organisatie.", "Configure your brand, domain and email step by step. You can change everything later under Organisation.")}</DialogDescription></DialogHeader>
    <div className="grid grid-cols-5 gap-2">{steps.map((Icon, index) => <button key={index} type="button" onClick={() => setStep(index)} className={`rounded-xl border p-2 ${index === step ? "border-primary bg-primary/10 text-primary" : index < step ? "text-emerald-600" : "text-muted-foreground"}`}><Icon className="mx-auto size-4"/><span className="sr-only">{index + 1}</span></button>)}</div>
    <div className="min-h-72 space-y-4 py-2">
      {step === 0 && <><h3 className="font-display text-xl font-semibold">{text("Welkom bij je eigen Agency-workspace", "Welcome to your own Agency workspace")}</h3><p className="text-sm text-muted-foreground">{text("Deze wizard controleert wat klanten straks zien en vanaf welk adres zij communicatie ontvangen. Er wordt niets openbaar gemaakt voordat jij dat opslaat en test.", "This wizard checks what clients will see and which address sends their communication. Nothing is published until you save and test it.")}</p><div className="grid gap-3 sm:grid-cols-3"><Info icon={Palette} title={text("Eigen merk", "Your brand")}/><Info icon={Globe2} title={text("Eigen portal", "Your portal")}/><Info icon={MailCheck} title={text("Geteste e-mail", "Tested email")}/></div></>}
      {step === 1 && <div className="grid gap-4 sm:grid-cols-2"><Field label={text("Organisatienaam", "Organisation name")} value={settings.systemName} onChange={(value) => setSetting("systemName", value)}/><Field label={text("Afzendernaam", "Sender name")} value={settings.senderName} onChange={(value) => setSetting("senderName", value)}/><Field label={text("Contactadres", "Contact email")} type="email" value={settings.contactEmail} onChange={(value) => setSetting("contactEmail", value)}/><Field label="Tagline" value={settings.tagline} onChange={(value) => setSetting("tagline", value)}/><label className="space-y-2 text-sm sm:col-span-2"><span>{text("Accentkleur", "Accent colour")} · {settings.accent}°</span><Slider min={0} max={360} value={[settings.accent]} onValueChange={(value) => setSetting("accent", value[0] ?? 172)}/></label><label className="space-y-2 text-sm sm:col-span-2"><span>Logo</span><Input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy === "logo"} onChange={(event) => void uploadLogo(event.target.files?.[0])}/><small className="text-muted-foreground">PNG, JPG, WebP · max. 2 MB {settings.logoPath ? `· ${text("geselecteerd", "selected")}` : ""}</small></label></div>}
      {step === 2 && <div className="space-y-4"><Field label={text("GlobeTrotr-subdomein", "GlobeTrotr subdomain")} value={delivery.subdomain} suffix=".globetrotr.nl" onChange={(value) => setDeliveryValue("subdomain", value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}/><Field label={text("Eigen domein (optioneel)", "Custom domain (optional)")} value={delivery.customDomain} placeholder="reizen.jouwbedrijf.nl" onChange={(value) => { setDeliveryValue("customDomain", value.toLowerCase().trim()); setTurnstileConfirmed(false); }}/>{delivery.customDomain && <div className="rounded-xl border bg-muted/30 p-4 text-sm"><p>CNAME <strong>{delivery.customDomain}</strong> → <strong>portal.globetrotr.nl</strong></p><p className="mt-2">TXT <strong>_globetrotr.{delivery.customDomain}</strong></p><code className="mt-1 block break-all text-xs">globetrotr-verification={delivery.verificationToken || text("verschijnt na opslaan", "appears after saving")}</code><p className="mt-3 text-xs text-muted-foreground">{text("Voeg daarnaast het hoofddomein toe onder Cloudflare Turnstile → Hostname Management. Bijvoorbeeld voor reizen.bedrijf.nl voeg je bedrijf.nl toe.", "Also add the root domain under Cloudflare Turnstile → Hostname Management. For example, for travel.company.com add company.com.")}</p><label className="mt-3 flex gap-2"><input type="checkbox" checked={turnstileConfirmed} onChange={(event) => setTurnstileConfirmed(event.target.checked)}/>{text("Turnstile-hoofddomein is toegevoegd", "Turnstile root domain has been added")}</label></div>}</div>}
      {step === 3 && <div className="grid gap-4 sm:grid-cols-2"><Field label={text("Afzenderadres", "From address")} type="email" value={delivery.fromEmail} onChange={(value) => setDeliveryValue("fromEmail", value)}/><Field label="Reply-to" type="email" value={delivery.replyTo} onChange={(value) => setDeliveryValue("replyTo", value)}/><Field label="SMTP host" value={delivery.smtpHost} placeholder="smtp.jouwprovider.nl" onChange={(value) => setDeliveryValue("smtpHost", value)}/><Field label={text("SMTP-poort", "SMTP port")} type="number" value={String(delivery.smtpPort)} onChange={(value) => setDeliveryValue("smtpPort", Number(value))}/><Field label={text("SMTP-gebruikersnaam", "SMTP username")} value={delivery.smtpUsername} onChange={(value) => setDeliveryValue("smtpUsername", value)}/><Field label={text("SMTP-wachtwoord", "SMTP password")} type="password" value={smtpPassword} placeholder={delivery.smtpPasswordSet ? "••••••••••••" : ""} onChange={setSmtpPassword}/><label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={delivery.smtpSecure} onChange={(event) => setDeliveryValue("smtpSecure", event.target.checked)}/>{text("Direct TLS, meestal poort 465", "Direct TLS, usually port 465")}</label><p className="text-xs text-muted-foreground sm:col-span-2">{text("Laat SMTP leeg om voorlopig de centrale GlobeTrotr-relay te gebruiken. Je wachtwoord wordt versleuteld opgeslagen en nooit opnieuw getoond.", "Leave SMTP blank to use the central GlobeTrotr relay for now. Your password is stored encrypted and never shown again.")}</p></div>}
      {step === 4 && <div className="space-y-3"><Status ok={Boolean(settings.systemName && settings.contactEmail)} label={text("Organisatie en huisstijl", "Organisation and branding")}/><Status ok={Boolean(delivery.subdomain)} label={text("Agency-subdomein", "Agency subdomain")}/><Status ok={!delivery.customDomain || delivery.domainStatus === "verified"} label={text("DNS en eigen domein", "DNS and custom domain")} action={delivery.customDomain ? <Button size="sm" variant="outline" disabled={busy === "domain"} onClick={() => void verifyDomain()}>{text("DNS testen", "Test DNS")}</Button> : undefined}/><Status ok={!delivery.customDomain || turnstileConfirmed} label="Cloudflare Turnstile"/><Status ok={!delivery.smtpConfigured || delivery.smtpTestStatus === "ok"} label={text("SMTP of centrale relay", "SMTP or central relay")} action={delivery.smtpConfigured ? <Button size="sm" variant="outline" disabled={busy === "smtp"} onClick={() => void testSmtp()}>{text("Testmail sturen", "Send test email")}</Button> : undefined}/><p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{text("Test na afronden ook registratie op het Agency-domein, een uitnodiging en een ontvangen e-mail. Passkeys blijven op externe domeinen verborgen omdat de GlobeTrotr RP-ID daar niet geldig is.", "After finishing, also test registration on the Agency domain, an invitation and a received email. Passkeys remain hidden on external domains because the GlobeTrotr RP ID is not valid there.")}</p></div>}
    </div>
    <div className="flex flex-wrap justify-between gap-2"><Button variant="ghost" disabled={step === 0 || Boolean(busy)} onClick={() => setStep((value) => Math.max(0, value - 1))}><ChevronLeft className="size-4"/>{text("Vorige", "Previous")}</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(false)}>{text("Later verder", "Continue later")}</Button>{step === 1 ? <Button disabled={Boolean(busy)} onClick={() => void saveBranding()}>{text("Opslaan en verder", "Save and continue")}</Button> : step === 2 ? <Button disabled={!delivery.subdomain || Boolean(busy)} onClick={() => setStep(3)}>{text("Verder", "Continue")}<ChevronRight className="size-4"/></Button> : step === 3 ? <Button disabled={Boolean(busy)} onClick={() => void saveDelivery()}>{text("Opslaan en controleren", "Save and review")}</Button> : step === 4 ? <Button disabled={Boolean(busy)} onClick={() => void finish()}><Check className="size-4"/>{text("Onboarding afronden", "Complete onboarding")}</Button> : <Button onClick={() => setStep(1)}>{text("Beginnen", "Get started")}<ChevronRight className="size-4"/></Button>}</div></div>
  </DialogContent></Dialog>;
}

function Field({ label, value, onChange, type="text", suffix, placeholder }: { label:string; value:string; onChange:(value:string)=>void; type?:string; suffix?:string; placeholder?:string }) { return <label className="space-y-1 text-sm"><span>{label}</span><div className="flex"><Input className={suffix ? "rounded-r-none" : ""} type={type} value={value} placeholder={placeholder} maxLength={254} onChange={(event) => onChange(event.target.value)}/>{suffix && <span className="flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-xs">{suffix}</span>}</div></label>; }
function Info({ icon:Icon, title }:{ icon:typeof Palette; title:string }) { return <div className="rounded-xl border p-4 text-center"><Icon className="mx-auto mb-2 size-5 text-primary"/><strong className="text-sm">{title}</strong></div>; }
function Status({ ok, label, action }:{ ok:boolean; label:string; action?:ReactNode }) { return <div className="flex items-center gap-3 rounded-xl border p-3"><span className={`grid size-7 place-items-center rounded-full ${ok ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{ok ? <Check className="size-4"/> : "!"}</span><span className="min-w-0 flex-1 text-sm font-medium">{label}</span>{action}</div>; }
