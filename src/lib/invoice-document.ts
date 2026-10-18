import type { InvoiceParty } from "./invoice-administration.ts";
export type IssuedInvoice = {
  id: string; invoice_number: string; invoice_date: string; service_date: string; due_date: string;
  kind: "invoice" | "credit"; credit_for_invoice: string | null; currency: string; issuer: InvoiceParty; recipient: InvoiceParty;
  credit_original_number?: string | null;
  lines: { description: string; quantity: number; unitPrice: number; vatRate: number; netMinor: number; vatMinor: number }[];
  tax_mode: string; tax_note: string; notes: string; net_minor: number; vat_minor: number; total_minor: number;
};
function escape(value: unknown) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }
export function invoiceDocument(invoice: IssuedInvoice, originalNumber?: string) {
  const money = (amount: number) => escape(new Intl.NumberFormat("nl-NL", { style: "currency", currency: invoice.currency }).format(amount / 100));
  const party = (value: InvoiceParty) => `<strong>${escape(value.legalName)}</strong><br>${escape(value.address)}<br>${escape(value.postalCode)} ${escape(value.city)}${value.region ? `<br>${escape(value.region)}` : ""}<br>${escape(value.country)}${value.registrationNumber ? `<br>KVK / registratie: ${escape(value.registrationNumber)}` : ""}${value.vatId ? `<br>Btw-id: ${escape(value.vatId)}` : ""}${value.email ? `<br>${escape(value.email)}` : ""}`;
  const credit = invoice.kind === "credit";
  const groups = new Map<number, { net: number; vat: number }>();
  for (const line of invoice.lines) { const group = groups.get(line.vatRate) ?? { net: 0, vat: 0 }; group.net += line.netMinor; group.vat += line.vatMinor; groups.set(line.vatRate, group); }
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(invoice.invoice_number)}</title><style>
body{font:14px Arial,sans-serif;color:#182330;max-width:900px;margin:40px auto;padding:20px}h1{font-size:28px}.parties{display:flex;gap:60px;justify-content:space-between;margin:30px 0}.parties>div{width:48%;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:10px 6px;border-bottom:1px solid #ccc;text-align:right}th:first-child,td:first-child{text-align:left;overflow-wrap:anywhere}.notes{white-space:pre-wrap}.total{font-size:20px;font-weight:bold;text-align:right}@media print{body{margin:0;padding:0}@page{size:A4;margin:18mm}thead{display:table-header-group}tr{break-inside:avoid}}
</style></head><body><h1>${credit ? "Creditfactuur" : "Factuur"} ${escape(invoice.invoice_number)}</h1>${credit ? `<p>Correctie op factuur ${escape(invoice.credit_original_number || originalNumber || invoice.credit_for_invoice)}</p>` : ""}
<p>Factuurdatum: ${escape(invoice.invoice_date)}<br>Leveringsdatum: ${escape(invoice.service_date)}<br>${credit ? "Correctiedatum" : "Vervaldatum"}: ${escape(invoice.due_date)}</p>
<div class="parties"><div>${party(invoice.issuer)}</div><div>Factuur aan:<br>${party(invoice.recipient)}</div></div>
<table><thead><tr><th>Omschrijving</th><th>Aantal</th><th>Prijs excl. btw</th><th>Btw</th><th>Excl. btw</th></tr></thead><tbody>${invoice.lines.map((line) => `<tr><td>${escape(line.description)}</td><td>${escape(line.quantity)}</td><td>${money(line.unitPrice * 100)}</td><td>${escape(line.vatRate)}%</td><td>${money(line.netMinor)}</td></tr>`).join("")}</tbody></table>
<p>Exclusief btw: ${money(invoice.net_minor)}</p>${[...groups].map(([rate, group]) => `<p>Btw ${rate}% over ${money(group.net)}: ${money(group.vat)}</p>`).join("")}
<p class="total">${credit ? "Creditbedrag" : "Totaal"}: ${money(invoice.total_minor)}</p>${invoice.tax_mode === "reverse_charge" ? "<p><strong>Btw verlegd</strong></p>" : invoice.tax_mode === "exempt" ? "<p><strong>Btw-vrijstelling</strong></p>" : ""}
<p class="notes">${escape(invoice.tax_note)}</p><p class="notes">${escape(invoice.notes)}</p>${invoice.issuer.iban ? `<p>IBAN: ${escape(invoice.issuer.iban)} · Referentie: ${escape(invoice.invoice_number)}</p>` : ""}</body></html>`;
}
export function invoiceLedgerCsv(invoices: IssuedInvoice[]) {
  const safe = (value: unknown) => `"${(typeof value === "number" ? value.toFixed(2) : String(value ?? "").replace(/^[\t\r\n ]*[=+@-]/, "'$&")).replace(/"/g, '""')}"`;
  const rows = [["Factuurnummer", "Datum", "Type", "Klant", "Registratie", "Btw-id", "Valuta", "Excl. btw", "Btw", "Totaal", "Credit op"],
    ...invoices.map((invoice) => [invoice.invoice_number, invoice.invoice_date, invoice.kind, invoice.recipient.legalName, invoice.recipient.registrationNumber,
      invoice.recipient.vatId, invoice.currency, invoice.net_minor / 100, invoice.vat_minor / 100, invoice.total_minor / 100, invoice.credit_original_number || invoice.credit_for_invoice || ""])];
  return "\uFEFF" + rows.map((row) => row.map(safe).join(";")).join("\r\n");
}
