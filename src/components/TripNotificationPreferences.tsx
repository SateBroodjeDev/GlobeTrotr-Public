import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/lib/locale";
import {
  getTripNotificationPreferences,
  saveTripNotificationPreferences,
  type TripNotificationPreferences as Values,
} from "@/lib/trip-notification-preferences.functions";

const defaults: Values = { planning: true, bookings: true, expenses: true, documents: true, flightAlerts: true };

export function TripNotificationPreferences({ tripId }: { tripId: string }) {
  const { text } = useLocale();
  const query = useQuery({
    queryKey: ["trip-notification-preferences", tripId],
    queryFn: () => getTripNotificationPreferences({ data: { tripId } }),
  });
  const [values, setValues] = useState(defaults);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (query.data) setValues(query.data); }, [query.data]);

  const rows: Array<[keyof Values, string, string]> = [
    ["planning", text("Planning en bestemmingen", "Planning and destinations"), text("Wijzigingen aan reisschema, datums en bestemmingen.", "Changes to itinerary, dates and destinations.")],
    ["bookings", text("Boekingen", "Bookings"), text("Toegevoegde, gewijzigde en verwijderde reisonderdelen.", "Added, changed and removed travel bookings.")],
    ["expenses", text("Uitgaven", "Expenses"), text("Wijzigingen aan gedeelde reiskosten.", "Changes to shared trip expenses.")],
    ["documents", text("Documenten", "Documents"), text("Nieuwe documenten, wijzigingen en naderende vervaldatums.", "New documents, changes and upcoming expiry dates.")],
    ["flightAlerts", text("Vluchtalerts", "Flight alerts"), text("Belangrijke vluchtstatus zodra automatische controle actief is.", "Important flight status updates once automatic checks are active.")],
  ];

  async function save() {
    setSaving(true);
    try {
      await saveTripNotificationPreferences({ data: { tripId, preferences: values } });
      toast.success(text("Meldingsvoorkeuren opgeslagen.", "Notification preferences saved."));
      await query.refetch();
    } catch {
      toast.error(text("Meldingsvoorkeuren konden niet worden opgeslagen.", "Notification preferences could not be saved."));
    } finally { setSaving(false); }
  }

  return <Card className="surface">
    <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Bell className="size-4"/>{text("Meldingen voor deze reis", "Notifications for this trip")}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">{text("Kies welke informatieve wijzigingen je ontvangt. Uitnodigingen, toegang, beveiliging en betaalverzoeken blijven altijd aan.", "Choose which informational updates you receive. Invitations, access, security and payment requests always remain enabled.")}</p>
      {query.isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>{text("Voorkeuren laden…", "Loading preferences…")}</div> : rows.map(([key,label,description]) => <label key={key} className="flex items-center justify-between gap-4 rounded-xl border p-3">
        <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-muted-foreground">{description}</span></span>
        <Switch checked={values[key]} onCheckedChange={(checked)=>setValues((current)=>({...current,[key]:checked}))} aria-label={label}/>
      </label>)}
      <Button type="button" disabled={saving||query.isLoading||query.isError} onClick={()=>void save()}>{saving&&<Loader2 className="size-4 animate-spin"/>}{saving?text("Opslaan…","Saving…"):text("Voorkeuren opslaan","Save preferences")}</Button>
    </CardContent>
  </Card>;
}
