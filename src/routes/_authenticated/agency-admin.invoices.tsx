import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale";
import { InvoiceBusinessProfile, InvoicePartyFields } from "@/components/InvoiceBusinessProfile";
import { emptyInvoiceParty, invoiceTotals, invoiceCurrencies, type InvoiceParty, type InvoiceLine, type InvoiceTaxMode } from "@/lib/invoice-administration";
import { getInvoiceAdministration, issueAgencyCustomerInvoice, creditAgencyCustomerInvoice, exportAgencyInvoiceLedger } from "@/lib/invoice-administration.functions";
import { invoiceDocument, type IssuedInvoice } from "@/lib/invoice-document";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/agency-admin/invoices")({ component: AgencyInvoices });
const initialLine: InvoiceLine = { description: "", quantity: 1, unitPrice: 0, vatRate: 0 };
function download(contents: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function AgencyInvoices() {
  const { text } = useLocale();
  const [offset, setOffset] = useState(0);
  const query = useQuery({ queryKey: ["invoice-administration", "agency", offset], queryFn: () => getInvoiceAdministration({ data: { scope: "agency", offset } }), retry: false });
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [clientId, setClientId] = useState("");
  const [recipient, setRecipient] = useState<InvoiceParty>({ ...emptyInvoiceParty }), [lines, setLines] = useState<InvoiceLine[]>([{ ...initialLine }]);
  const [currency, setCurrency] = useState("EUR"), [taxMode, setTaxMode] = useState<InvoiceTaxMode>("standard"), [taxNote, setTaxNote] = useState(""), [notes, setNotes] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10)), [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [requestId, setRequestId] = useState(() => crypto.randomUUID()), [confirmed, setConfirmed] = useState(false);
  const invoices = (query.data?.invoices ?? []) as IssuedInvoice[];
  let total: number | null = null;
  try { total = invoiceTotals(lines, taxMode, taxNote).totalMinor; } catch { /* Form is not complete. */ }
  const money = (amount: number, code = currency) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: code }).format(amount / 100);
  function selectClient(id: string) {
    setClientId(id); const client = query.data?.clients.find((item: any) => item.id === id);
    setRecipient({ ...emptyInvoiceParty, legalName: client?.full_name ?? "", email: client?.email ?? "", ...client?.billing_profile });
  }
  async function issue() {
    setBusy(true);
    try {
      const result = await issueAgencyCustomerInvoice({ data: { clientId, requestId, recipient, lines, currency, serviceDate, dueDate, taxMode, taxNote, notes } });
      setOpen(false); setRequestId(crypto.randomUUID()); setConfirmed(false); await query.refetch();
      toast.success(text("Factuur definitief uitgegeven.", "Invoice issued."));
      if (!result.clientProfileSaved) toast.warning(text("Factuur is opgeslagen; de herbruikbare klantgegevens konden niet worden bijgewerkt.", "Invoice saved; reusable client details could not be updated."));
    } catch { toast.error(text("Uitgifte mislukt. Controleer adressen, KVK/btw-id, datums, bedragen en fiscale toelichting. Probeer met dezelfde aanvraag opnieuw.", "Issue failed. Check addresses, company/VAT ID, dates, amounts and tax basis. Retry the same request.")); }
    finally { setBusy(false); }
  }
  async function exportLedger() {
    setBusy(true);
    try { const result = await exportAgencyInvoiceLedger(); download(result.csv, "agency-factuurregister.csv", "text/csv;charset=utf-8"); }
    catch { toast.error(text("Het volledige factuurregister kon niet worden geëxporteerd.", "The full invoice ledger could not be exported.")); }
    finally { setBusy(false); }
  }
  async function credit(invoice: IssuedInvoice) {
    const reason = window.prompt(text("Reden voor volledige creditfactuur (minimaal 5 tekens)", "Reason for a full credit note (at least 5 characters)"));
    if (!reason || reason.trim().length < 5) return;
    setBusy(true);
    try { await creditAgencyCustomerInvoice({ data: { invoiceId: invoice.id, requestId: crypto.randomUUID(), reason } }); await query.refetch(); toast.success(text("Creditfactuur uitgegeven.", "Credit note issued.")); }
    catch { toast.error(text("Creditfactuur kon niet worden uitgegeven. Vernieuw het overzicht voordat je opnieuw probeert.", "Credit note could not be issued. Refresh the list before retrying.")); }
    finally { setBusy(false); }
  }
  function print(invoice: IssuedInvoice) {
    const original = invoices.find((item) => item.id === invoice.credit_for_invoice);
    const url = URL.createObjectURL(new Blob([invoiceDocument(invoice, original?.invoice_number)], { type: "text/html" }));
    const frame = document.createElement("iframe"); frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    frame.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
    frame.onload = () => { frame.contentWindow?.focus(); frame.contentWindow?.print(); };
    frame.src = url; document.body.appendChild(frame);
    setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
  }
  if (query.isError) return <Card><CardContent className="p-6">{text("Facturen zijn niet beschikbaar. Vereist: Agency-facturatierecht en migratie 2100.", "Invoices are unavailable. Agency billing permission and migration 2100 are required.")}</CardContent></Card>;
  return <div className="space-y-6"><header><h1 className="font-display text-3xl font-semibold">{text("Klantfacturen", "Customer invoices")}</h1><p className="mt-2 text-sm text-muted-foreground">{text("Facturen van jouw Agency aan klanten. GlobeTrotr-abonnementsfacturen staan onder Abonnement en worden door Paddle uitgegeven.", "Invoices from your Agency to clients. GlobeTrotr subscription invoices are under Billing and are issued by Paddle.")}</p></header>
    <InvoiceBusinessProfile scope="agency" />
    <Card><CardHeader><CardTitle>{text("Factuuradministratie", "Invoice ledger")}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2">
      <Button disabled={query.isLoading || busy} onClick={() => { setLines([{ ...initialLine }]); setNotes(""); setTaxNote(""); setTaxMode("standard"); setConfirmed(false); selectClient(query.data?.clients[0]?.id ?? ""); setOpen(true); }}>{text("Nieuwe klantfactuur", "New customer invoice")}</Button>
      <Button variant="outline" disabled={busy || query.isLoading} onClick={() => void exportLedger()}>{text("Volledig register CSV", "Full ledger CSV")}</Button>
      <Button variant="outline" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - 250))}>{text("Nieuwere facturen", "Newer invoices")}</Button><Button variant="outline" disabled={invoices.length < 250 || busy} onClick={() => setOffset(offset + 250)}>{text("Oudere facturen", "Older invoices")}</Button>
    </div><p className="text-xs text-muted-foreground">{text("Uitgegeven facturen zijn onveranderlijk. Corrigeer met een volledige creditfactuur en een nieuwe factuur. Er worden maximaal 250 recente facturen getoond. Regelingen zoals de reisbureauregeling/margeregeling vereisen een aparte fiscale berekening en worden hier niet automatisch toegepast.", "Issued invoices are immutable. Correct with a full credit note and a new invoice. Up to 250 recent invoices are shown. Schemes such as the travel agents margin scheme require separate tax calculations and are not applied automatically here.")}</p>
    <div className="space-y-3">{invoices.map((invoice) => <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{invoice.invoice_number} · {invoice.recipient.legalName}</p><p className="text-sm text-muted-foreground">{invoice.invoice_date} · {money(invoice.total_minor, invoice.currency)} · {invoice.kind === "credit" ? text("Creditfactuur", "Credit note") : text("Factuur", "Invoice")}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => print(invoice)}>{text("Afdrukken / PDF", "Print / PDF")}</Button><Button size="sm" variant="outline" onClick={() => download(JSON.stringify(invoice, null, 2), `${invoice.invoice_number}.json`, "application/json")}>JSON</Button>{invoice.kind === "invoice" && !invoices.some((item) => item.credit_for_invoice === invoice.id) && <Button size="sm" variant="outline" disabled={busy} onClick={() => void credit(invoice)}>{text("Crediteren", "Credit")}</Button>}</div></div>)}</div></CardContent></Card>
    <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}><DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col overflow-hidden"><DialogHeader><DialogTitle>{text("Nieuwe klantfactuur", "New customer invoice")}</DialogTitle></DialogHeader><div className="space-y-5 overflow-y-auto pr-2">
      <label className="block space-y-1 text-sm"><span>{text("Klant", "Client")}</span><select className="h-10 w-full rounded-md border bg-background px-3" value={clientId} onChange={(event) => selectClient(event.target.value)}><option value="">{text("Kies klant", "Choose client")}</option>{query.data?.clients.map((client: any) => <option key={client.id} value={client.id}>{client.full_name}</option>)}</select></label>
      <InvoicePartyFields value={recipient} onChange={setRecipient} />
      <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">{text("Leveringsdatum", "Service date")}<Input type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></label><label className="text-sm">{text("Vervaldatum", "Due date")}<Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="text-sm">{text("Valuta", "Currency")}<select className="h-10 w-full rounded-md border bg-background px-3" value={currency} onChange={(event) => setCurrency(event.target.value)}>{invoiceCurrencies.map((code) => <option key={code}>{code}</option>)}</select></label></div>
      <label className="block text-sm">{text("Fiscale behandeling", "Tax treatment")}<select className="h-10 w-full rounded-md border bg-background px-3" value={taxMode} onChange={(event) => { setTaxMode(event.target.value as InvoiceTaxMode); setLines(lines.map((line) => ({ ...line, vatRate: 0 }))); }}><option value="standard">{text("Gewone btw (kies tarief per regel)", "Standard VAT (select each rate)")}</option><option value="exempt">{text("Btw-vrijstelling / KOR", "VAT exemption")}</option><option value="reverse_charge">{text("Btw verlegd", "Reverse charge")}</option></select></label>
      {lines.map((line, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-4"><label className="text-sm sm:col-span-4">{text("Omschrijving geleverde dienst", "Service description")}<Input maxLength={500} value={line.description} onChange={(event) => setLines(lines.map((item, row) => row === index ? { ...item, description: event.target.value } : item))} /></label><label className="text-sm">{text("Aantal", "Quantity")}<Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => setLines(lines.map((item, row) => row === index ? { ...item, quantity: Number(event.target.value) } : item))} /></label><label className="text-sm">{text("Prijs excl. btw", "Price excl. VAT")}<Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLines(lines.map((item, row) => row === index ? { ...item, unitPrice: Number(event.target.value) } : item))} /></label><label className="text-sm">{text("Btw-tarief", "VAT rate")}<select disabled={taxMode !== "standard"} className="h-10 w-full rounded-md border bg-background px-3" value={line.vatRate} onChange={(event) => setLines(lines.map((item, row) => row === index ? { ...item, vatRate: Number(event.target.value) } : item))}>{[0, 9, 21].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></label><Button variant="outline" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, row) => row !== index))}>{text("Verwijderen", "Remove")}</Button></div>)}
      <Button variant="outline" disabled={lines.length >= 100} onClick={() => setLines([...lines, { ...initialLine }])}>{text("Factuurregel toevoegen", "Add line")}</Button>
      <label className="block text-sm">{text("Fiscale grondslag / toelichting (verplicht bij 0%, vrijstelling of verlegging)", "Tax basis / explanation (required for 0%, exemption or reverse charge)")}<Textarea maxLength={500} value={taxNote} onChange={(event) => setTaxNote(event.target.value)} /></label>
      <label className="block text-sm">{text("Betalingsinstructies / notities", "Payment instructions / notes")}<Textarea maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <p className="font-semibold">{text("Totaal", "Total")}: {total === null ? text("Vul de factuur aan", "Complete the invoice") : money(total)}</p>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>{text("Ik heb afzender, ontvanger, leveringsdatum en fiscale behandeling gecontroleerd. Uitgifte legt de factuur definitief vast.", "I checked issuer, recipient, service date and tax treatment. Issuing permanently records this invoice.")}</span></label>
    </div><Button disabled={busy || !confirmed || !clientId || total === null} onClick={() => void issue()}>{text("Definitief uitgeven", "Issue invoice")}</Button></DialogContent></Dialog>
  </div>;
}
