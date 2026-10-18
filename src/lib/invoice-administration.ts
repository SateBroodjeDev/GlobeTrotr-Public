import { countryCode } from "./countries.ts";
export type InvoiceParty = {
  legalName: string; registrationNumber: string; vatId: string; address: string;
  postalCode: string; city: string; region: string; country: string; email: string; iban: string;
};
export const emptyInvoiceParty: InvoiceParty = { legalName: "", registrationNumber: "", vatId: "", address: "", postalCode: "", city: "", region: "", country: "NL", email: "", iban: "" };
export type InvoiceLine = { description: string; quantity: number; unitPrice: number; vatRate: number };
export type InvoiceTaxMode = "standard" | "exempt" | "reverse_charge";
export const invoiceCurrencies = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CAD", "AUD"];

export function normalizeInvoiceParty(input: Partial<InvoiceParty>): InvoiceParty {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("INVOICE_PARTY_INVALID");
  const result = { ...emptyInvoiceParty };
  for (const key of Object.keys(result) as (keyof InvoiceParty)[]) {
    if (input[key] !== undefined && typeof input[key] !== "string") throw new Error("INVOICE_PARTY_INVALID");
    result[key] = (input[key] ?? result[key]).trim();
    if (result[key].length > (key === "email" ? 254 : 180) || [...result[key]].some((character) => character.charCodeAt(0) < 32)) throw new Error("INVOICE_PARTY_INVALID");
  }
  result.country = result.country.toUpperCase();
  result.vatId = result.vatId.replace(/\s/g, "").toUpperCase();
  result.registrationNumber = result.registrationNumber.replace(/\s/g, "");
  result.iban = result.iban.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(result.country) || !countryCode(result.country)) throw new Error("INVOICE_COUNTRY_INVALID");
  if (result.country === "NL" && result.registrationNumber && !/^\d{8}$/.test(result.registrationNumber)) throw new Error("INVOICE_KVK_INVALID");
  if (result.vatId && !(result.vatId.startsWith("NL") ? /^NL\d{9}B\d{2}$/ : /^[A-Z]{2}[A-Z0-9]{2,20}$/).test(result.vatId)) throw new Error("INVOICE_VAT_ID_INVALID");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error("INVOICE_EMAIL_INVALID");
  if (result.iban) {
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(result.iban)) throw new Error("INVOICE_IBAN_INVALID");
    const reordered = result.iban.slice(4) + result.iban.slice(0, 4);
    let remainder = 0;
    for (const digit of reordered.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55))) remainder = (remainder * 10 + Number(digit)) % 97;
    if (remainder !== 1) throw new Error("INVOICE_IBAN_INVALID");
  }
  return result;
}
export function requireInvoiceParty(party: InvoiceParty, issuer = false, taxMode: InvoiceTaxMode = "standard") {
  if (!party.legalName || !party.address || !party.postalCode || !party.city) throw new Error("INVOICE_ADDRESS_REQUIRED");
  if (issuer && party.country === "NL" && !party.registrationNumber) throw new Error("INVOICE_KVK_REQUIRED");
  if ((issuer && taxMode !== "exempt") || (!issuer && taxMode === "reverse_charge")) {
    if (!party.vatId) throw new Error("INVOICE_VAT_ID_REQUIRED");
  }
}
export function invoiceTotals(lines: InvoiceLine[], mode: InvoiceTaxMode, note: string, credit = false) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) throw new Error("INVOICE_LINES_REQUIRED");
  if (lines.some((line) => !line || typeof line !== "object" || Array.isArray(line))) throw new Error("INVOICE_LINE_INVALID");
  if (typeof note !== "string" || !["standard", "exempt", "reverse_charge"].includes(mode) || ((mode !== "standard" || lines.some((line) => line.vatRate === 0)) && !note.trim())) throw new Error("INVOICE_TAX_BASIS_REQUIRED");
  const normalized = lines.map((line) => {
    if (typeof line.description !== "string") throw new Error("INVOICE_LINE_INVALID");
    const description = line.description.trim();
    if (!description || description.length > 500 || !Number.isFinite(line.quantity) || line.quantity <= 0 || line.quantity > 100000
      || !Number.isInteger(Math.round(line.quantity * 1000)) || Math.abs(line.quantity * 1000 - Math.round(line.quantity * 1000)) > 0.000001
      || !Number.isFinite(line.unitPrice) || line.unitPrice < 0 || line.unitPrice > 1000000 || Math.abs(line.unitPrice * 100 - Math.round(line.unitPrice * 100)) > 0.000001
      || ![0, 9, 21].includes(line.vatRate) || (mode !== "standard" && line.vatRate !== 0)) throw new Error("INVOICE_LINE_INVALID");
    // Multiply integer thousandths by integer cents. Floating multiplication
    // rounds 1.005 * 100 down on some inputs, losing a cent on an issued invoice.
    const netMinor = Number((BigInt(Math.round(line.quantity * 1000)) * BigInt(Math.round(line.unitPrice * 100)) + 500n) / 1000n);
    const vatMinor = Math.round(netMinor * line.vatRate / 100);
    return { description, quantity: line.quantity, unitPrice: line.unitPrice, vatRate: line.vatRate,
      netMinor: credit ? -netMinor : netMinor, vatMinor: credit ? -vatMinor : vatMinor };
  });
  const netMinor = normalized.reduce((sum, line) => sum + line.netMinor, 0), vatMinor = normalized.reduce((sum, line) => sum + line.vatMinor, 0);
  if (!Number.isSafeInteger(netMinor + vatMinor) || Math.abs(netMinor + vatMinor) > 10000000000) throw new Error("INVOICE_TOTAL_LIMIT");
  return { lines: normalized, netMinor, vatMinor, totalMinor: netMinor + vatMinor };
}

export function paddleBusinessPayload(party: InvoiceParty) {
  requireInvoiceParty(party);
  return { name: party.legalName, company_number: party.registrationNumber || null, tax_identifier: party.vatId || null,
    contacts: party.email ? [{ name: party.legalName, email: party.email }] : [] };
}
