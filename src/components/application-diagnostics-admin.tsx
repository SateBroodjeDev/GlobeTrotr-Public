import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getApplicationDiagnostics, manageApplicationDiagnostic } from "@/lib/issues.functions";
import { useLocale } from "@/lib/locale";

export function ApplicationDiagnosticsAdmin({ owner }: { owner: boolean }) {
  const { text, locale } = useLocale();
  const query = useQuery({ queryKey: ["application-diagnostics"], queryFn: () => getApplicationDiagnostics(),
    retry: false, staleTime: 60_000, refetchOnWindowFocus: false });
  const [busy, setBusy] = useState(false);
  async function change(data: Parameters<typeof manageApplicationDiagnostic>[0]["data"]) {
    setBusy(true);
    try { await manageApplicationDiagnostic({ data }); await query.refetch(); }
    catch { toast.error(text("Bijwerken mislukt. Probeer het opnieuw.", "Update failed. Please retry.")); }
    finally { setBusy(false); }
  }
  if (query.isPending) return <p role="status">{text("Laden...", "Loading...")}</p>;
  if (query.isError || !query.data) return <div role="alert" className="space-y-3">
    <p>{text("Foutregistratie is niet beschikbaar. Controleer de vrijgegeven database-update en configuratie.", "Error reporting is unavailable. Check the approved database update and configuration.")}</p>
    <Button onClick={() => void query.refetch()}>{text("Opnieuw proberen", "Retry")}</Button>
  </div>;
  const { enabled, notificationsEnabled, rows } = query.data;
  return <section className="space-y-5" aria-label={text("Technische fouten", "Application errors")}>
    <div className="flex flex-wrap items-center gap-3">
      <p className="mr-auto text-sm">{enabled ? text("Registratie aan", "Reporting enabled") : text("Registratie uit", "Reporting disabled")}
        {" · "}{notificationsEnabled && enabled ? text("Teamwaarschuwingen aan", "Team alerts enabled") : text("Teamwaarschuwingen uit", "Team alerts disabled")}</p>
      <Button variant="outline" disabled={busy || query.isFetching} onClick={() => void query.refetch()}>{text("Vernieuwen", "Refresh")}</Button>
      {owner && <>
        <Button variant="outline" disabled={busy} onClick={() => void change({ action: enabled ? "disable" : "enable" })}>{enabled ? text("Registratie uitzetten", "Disable reporting") : text("Registratie aanzetten", "Enable reporting")}</Button>
        <Button variant="outline" disabled={busy || !enabled} onClick={() => void change({ action: notificationsEnabled ? "alerts_off" : "alerts_on" })}>{notificationsEnabled ? text("Waarschuwingen uitzetten", "Disable alerts") : text("Waarschuwingen aanzetten", "Enable alerts")}</Button>
      </>}
    </div>
    <div className="max-w-3xl space-y-2">
      <h2 className="font-display text-xl font-semibold">{text("Fouten tijdens gebruik", "Errors during use")}</h2>
      <p className="text-sm text-muted-foreground">{text("Als een vriendschapsactie of het opslaan van een reis of uitgave technisch mislukt, verschijnt hier een melding. Zo kan het team onderzoeken wat er fout ging en in welke versie.", "When a friendship action or saving a trip or expense fails technically, a report appears here. This helps the team investigate what failed and in which version.")}</p>
      <p className="text-sm text-muted-foreground">{text("Dit overzicht controleert deze functies niet zelf. De openbare status en incidentupdates beheer je bij Incidenten.", "This overview does not test these features itself. Public service status and incident updates are managed under Incidents.")}</p>
    </div>
    <details className="max-w-3xl text-sm text-muted-foreground">
      <summary className="cursor-pointer">{text("Wat wordt geregistreerd en wanneer krijg je bericht?", "What is recorded and when will you be notified?")}</summary>
      <div className="mt-3 space-y-2">
        <p>{text("Alleen een vaste foutcode, tijdstip, releaseversie en het aantal opgeslagen foutmeldingen. Geen reisinhoud, e-mailadressen of wachtwoorden. Gewone invoerfouten, geweigerde toegang en gelijktijdige wijzigingen tellen niet als storing.", "Only a fixed error code, timestamp, release version and a count of stored error reports. No trip content, email addresses or passwords. Normal validation errors, denied access and concurrent edits are not treated as outages.")}</p>
        <p>{text("Herhaalde fouten worden samengevoegd. Het aantal is een steekproef, geen telling van gebruikers of alle mislukte acties. Afsluiten markeert een melding als afgehandeld; een volgende fout heropent diezelfde melding.", "Repeated errors are grouped. The count is sampled, not a count of users or all failed actions. Closing marks a report as handled; another failure reopens the same report.")}</p>
        <p>{text("Met teamwaarschuwingen aan volgt bericht na drie opgeslagen fouten binnen tien minuten, maximaal eenmaal per melding per 24 uur. Er verschijnt geen automatisch openbaar incident en er wordt geen automatische herstelmail verstuurd.", "When team alerts are enabled, three recorded errors within ten minutes trigger a notification, at most once per report per 24 hours. No public incident is created automatically and no automatic recovery email is sent.")}</p>
      </div>
    </details>
    {!rows.length && <p>{enabled ? text("Nog geen technische fouten vastgelegd voor deze acties.", "No technical errors recorded for these actions yet.") : text("Registratie staat uit. Nieuwe technische fouten worden niet vastgelegd.", "Reporting is disabled. New technical errors are not recorded.")}</p>}
    <div className="divide-y">{rows.map(row => <article key={row.id} className="space-y-3 py-4">
      <div className="flex flex-wrap items-center gap-3"><h3 className="break-all font-mono text-sm font-semibold">{row.code}</h3>
        <span className="text-sm">{row.status === "open" ? text("Open", "Open") : text("Afgesloten", "Closed")}</span>
        <span className="ml-auto text-sm">{row.samples} {text("samples", "samples")}</span>
        {row.status === "open" && <Button variant="outline" size="sm" disabled={busy} onClick={() => void change({ action: "resolve", id: row.id })}>{text("Afsluiten", "Close")}</Button>}</div>
      <p className="text-sm text-muted-foreground">{text("Laatst gezien", "Last seen")}: {new Date(row.last_seen).toLocaleString(locale)}</p>
      <details className="text-sm"><summary className="cursor-pointer">{text("Technische gegevens", "Technical details")}</summary>
        <dl className="mt-3 grid gap-2 break-all"><div><dt>{text("Dossier", "Dossier")}</dt><dd>{row.id}</dd></div>
          <div><dt>{text("Actie", "Action")}</dt><dd>{row.operation}</dd></div>
          <div><dt>{text("Eerste / laatste release", "First / last release")}</dt><dd className="font-mono">{row.first_release} / {row.last_release}</dd></div>
          <div><dt>{text("Eerst gezien", "First seen")}</dt><dd>{new Date(row.first_seen).toLocaleString(locale)}</dd></div></dl>

      </details>
    </article>)}</div>
  </section>;
}
