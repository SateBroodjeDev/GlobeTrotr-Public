import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale";
import { emptyInvoiceParty, type InvoiceParty } from "@/lib/invoice-administration";
import { getInvoiceAdministration, saveInvoiceBusinessProfile } from "@/lib/invoice-administration.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countryOptions } from "@/lib/countries";
import { syncPaddleInvoiceBusiness } from "@/lib/billing.functions";

export function InvoicePartyFields({ value, onChange, issuer = false }: { value: InvoiceParty; onChange: (value: InvoiceParty) => void; issuer?: boolean }) {
  const { text, locale } = useLocale();
  const fields: [keyof InvoiceParty, string, string][] = [
    ["legalName", "Juridische naam / factuurnaam", "Legal / invoice name"], ["registrationNumber", "KVK- / registratienummer", "Company registration number"],
    ["vatId", "Btw-identificatienummer (geen OB-nummer)", "VAT ID (not a personal tax number)"], ["address", "Straat en huisnummer", "Street and number"],
    ["postalCode", "Postcode", "Postal code"], ["city", "Plaats", "City"], ["region", "Provincie / regio", "State / region"],
    ["country", "Landcode (NL, BE, ...)", "Country code (NL, BE, ...)"], ["email", "Factuurcontact e-mail", "Invoice contact email"],
    ...(issuer ? [["iban", "IBAN", "IBAN"] as [keyof InvoiceParty, string, string]] : []),
  ];
  return <div className="grid gap-3 sm:grid-cols-2">{fields.map(([key, nl, en]) => <label key={key} className="space-y-1 text-sm"><span>{key === "country" ? text("Land", "Country") : text(nl, en)}</span>{key === "country" ? <select className="h-10 w-full rounded-md border bg-background px-3" value={value.country} onChange={(event) => onChange({ ...value, country: event.target.value })}>{countryOptions(locale).map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}</select> : <Input
    value={value[key]} maxLength={key === "email" ? 254 : 180} type={key === "email" ? "email" : "text"}
    onChange={(event) => onChange({ ...value, [key]: event.target.value })} />}</label>)}</div>;
}
export function InvoiceBusinessProfile({ scope }: { scope: "account" | "agency" }) {
  const { text } = useLocale(), cache = useQueryClient();
  const query = useQuery({ queryKey: ["invoice-administration", scope], queryFn: () => getInvoiceAdministration({ data: { scope } }), retry: false });
  const [profile, setProfile] = useState<InvoiceParty>({ ...emptyInvoiceParty }), [busy, setBusy] = useState(false);
  useEffect(() => { if (query.data) setProfile(query.data.profile); }, [query.data]);
  async function save() {
    setBusy(true);
    try { await saveInvoiceBusinessProfile({ data: { scope, profile } }); await cache.invalidateQueries({ queryKey: ["invoice-administration"] });
      toast.success(text("Factuurgegevens opgeslagen.", "Invoice details saved.")); }
    catch { toast.error(text("Opslaan mislukt. Controleer KVK, btw-id, e-mail en IBAN. Is migratie 2100 uitgevoerd?", "Save failed. Check company number, VAT ID, email and IBAN. Has migration 2100 been applied?")); }
    finally { setBusy(false); }
  }
  async function sync() {
    setBusy(true);
    try { const result = await syncPaddleInvoiceBusiness(); toast.success(result.updatedSubscriptions
      ? text("Paddle-bedrijfsgegevens bijgewerkt voor toekomstige abonnementsfacturen.", "Paddle business details updated for future subscription invoices.")
      : text("Paddle-bedrijfsgegevens gereed voor je volgende checkout.", "Paddle business details ready for your next checkout.")); }
    catch { toast.error(text("Paddle kon niet worden bijgewerkt. Controleer je opgeslagen gegevens en probeer opnieuw.", "Paddle could not be updated. Check your saved details and retry.")); }
    finally { setBusy(false); }
  }
  return <Card className="surface"><CardHeader><CardTitle>{text("Bedrijfsgegevens voor facturen", "Business invoice details")}</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">{text("Gebruik je juridische naam, volledige adres, KVK-nummer en btw-id. Deze gegevens worden vastgelegd op nieuwe klantfacturen en doorgegeven bij een nieuwe Paddle-checkout. Bestaande facturen veranderen niet.", "Use your legal name, full address, company number and VAT ID. New customer invoices retain these details and a new Paddle checkout receives them. Existing invoices do not change.")}</p>
    {query.isError ? <p className="text-sm text-destructive">{text("Factuurgegevens zijn niet beschikbaar of je hebt geen facturatierecht.", "Invoice details are unavailable or you lack billing permission.")}</p> : <><InvoicePartyFields value={profile} onChange={setProfile} issuer />
      <p className="text-xs text-muted-foreground">{text("Formaatcontrole bevestigt geen inschrijving of geldigheid van een btw-id. Controleer dit bij KVK/VIES en laat de fiscale regeling door je administratie bepalen.", "Format validation does not verify registration or VAT validity. Check company registers/VIES and have your administration determine the tax treatment.")}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || query.isLoading} onClick={() => void save()}>{text("Factuurgegevens opslaan", "Save invoice details")}</Button>{scope === "account" && <Button variant="outline" disabled={busy || query.isLoading || !query.data?.profile.legalName} onClick={() => void sync()}>{text("Opgeslagen gegevens naar Paddle", "Sync saved details to Paddle")}</Button>}</div>
      {scope === "account" && <p className="text-xs text-muted-foreground">{text("Sla eerst op. Gebruik daarna de Paddle-knop voor toekomstige facturen van een bestaand abonnement. Correcties op al uitgegeven Paddle-facturen vraag je via GlobeTrotr Support aan.", "Save first. Then use the Paddle button for future invoices on an existing subscription. Request corrections to already issued Paddle invoices through GlobeTrotr Support.")}</p>}</>}
  </CardContent></Card>;
}
