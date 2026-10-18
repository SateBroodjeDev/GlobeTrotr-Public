import { CATEGORIES, type Trip } from "./types.ts";
import { convert, formatMoney, type Rates } from "./services.ts";
import { isRoutePlanningItem } from "./types.ts";
import type { AppLocale } from "./locale.tsx";
import { localizeCountry } from "./localized-values.ts";

export function downloadCsv(trip: Trip, base: string, rates: Rates, locale: AppLocale) {
  const en = locale === "en-GB";
  const rows = [
    en
      ? [
          "Date",
          "Description",
          "Category",
          "Amount",
          "Currency",
          `Amount (${base})`,
          "Paid by",
          "Billable",
        ]
      : [
          "Datum",
          "Omschrijving",
          "Categorie",
          "Bedrag",
          "Valuta",
          `Bedrag (${base})`,
          "Betaald door",
          "Declarabel",
        ],
    ...trip.expenses.map((e) => [
      e.date,
      e.title,
      exportCategory(e.category, locale),
      e.amount.toFixed(2),
      e.currency,
      convert(e.amount, e.currency, base, rates).toFixed(2),
      e.paidBy,
      e.billable ? (en ? "yes" : "ja") : en ? "no" : "nee",
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(trip.name)}-${en ? "expenses" : "uitgaven"}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function safeFileName(value: string) {
  return slug(value) || "globetrotr-trip";
}

function icsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(value: string) {
  return value.replaceAll("-", "");
}

function nextIcsDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function foldIcsLine(line: string) {
  const parts: string[] = [];
  let part = "";
  let bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 74) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += character;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
}

/** Provider-onafhankelijke agenda-export voor gangbare agenda-apps. */
export function buildTripCalendar(trip: Trip) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const events = [
    ...trip.itinerary.map((item) => ({
      id: `itinerary-${item.id}`,
      title: item.title,
      notes: item.notes ?? "",
      date: item.day,
      endDate: item.day,
      startTime: "",
      endTime: "",
      location: "",
      allDay: true,
    })),
    ...(trip.travelItems ?? []).filter((item) => !isRoutePlanningItem(item)).map((item) => ({
      id: `booking-${item.id}`,
      title: item.title,
      notes: item.notes ?? "",
      date: item.date,
      endDate: item.endDate ?? item.date,
      startTime: item.details?.startTime ?? "",
      endTime: item.details?.endTime ?? "",
      location: item.location?.name ?? item.departure?.name ?? item.arrival?.name ?? "",
      allDay: item.type === "lodging" || item.type === "car_rental",
    })),
  ].filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GlobeTrotr//Trip Calendar//NL",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsText(trip.name)}`,
  ];
  for (const event of events) {
    const timed = !event.allDay && /^\d{2}:\d{2}$/.test(event.startTime);
    lines.push("BEGIN:VEVENT", `UID:${event.id}@globetrotr.nl`, `DTSTAMP:${stamp}`);
    if (timed) {
      lines.push(`DTSTART:${icsDate(event.date)}T${event.startTime.replace(":", "")}00`);
      if (/^\d{2}:\d{2}$/.test(event.endTime))
        lines.push(`DTEND:${icsDate(event.endDate)}T${event.endTime.replace(":", "")}00`);
      else {
        const end = new Date(`${event.date}T${event.startTime}:00`);
        end.setHours(end.getHours() + 1);
        lines.push(`DTEND:${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, "0")}${String(end.getDate()).padStart(2, "0")}T${String(end.getHours()).padStart(2, "0")}${String(end.getMinutes()).padStart(2, "0")}00`);
      }
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
        `DTEND;VALUE=DATE:${nextIcsDate(event.endDate)}`,
      );
    }
    lines.push(`SUMMARY:${icsText(event.title)}`);
    if (event.notes) lines.push(`DESCRIPTION:${icsText(event.notes)}`);
    if (event.location) lines.push(`LOCATION:${icsText(event.location)}`);
    lines.push(`TRANSP:${event.allDay ? "TRANSPARENT" : "OPAQUE"}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

export function downloadTripCalendar(trip: Trip) {
  const blob = new Blob([buildTripCalendar(trip)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug(trip.name)}-agenda.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function escapeXml(value: string) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function gpxRouteStops(trip: Trip) {
  return trip.stops.filter((stop) => {
    const present = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== "";
    if (!present(stop.lat) || !present(stop.lon)) return false;
    const lat = Number(stop.lat);
    const lon = Number(stop.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  });
}

export function buildTripGpx(trip: Trip) {
  const points = gpxRouteStops(trip)
    .map(
      (stop) =>
        `    <rtept lat="${Number(stop.lat)}" lon="${Number(stop.lon)}"><name>${escapeXml(stop.name)}</name><desc>${escapeXml(stop.country)}</desc></rtept>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GlobeTrotr" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${escapeXml(trip.name)}</name></metadata>\n  <rte><name>${escapeXml(trip.name)}</name>\n${points}\n  </rte>\n</gpx>\n`;
}

export function downloadTripGpx(trip: Trip) {
  if (!gpxRouteStops(trip).length) return false;
  const blob = new Blob([buildTripGpx(trip)], { type: "application/gpx+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(trip.name)}.gpx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return true;
}

export function openPdf(
  trip: Trip,
  base: string,
  rates: Rates,
  brand: { brandName: string; domain: string },
  locale: AppLocale,
  coverUrl?: string | null,
) {
  const en = locale === "en-GB";
  const total = trip.expenses.reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0);
  const billable = trip.expenses
    .filter((e) => e.billable)
    .reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0);

  const html = `<!doctype html><html lang="${en ? "en" : "nl"}"><head><meta charset="utf-8">
<title>${en ? "Expense claim" : "Declaratie"} — ${escapeHtml(trip.name)}</title>
<style>
 body{font-family:ui-sans-serif,system-ui,Helvetica,Arial;margin:40px;color:#12211f}
 h1{font-size:22px;margin:0 0 4px}
 .muted{color:#68807c;font-size:12px}
 .brand{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0f9b8e;padding-bottom:12px;margin-bottom:24px}
 table{width:100%;border-collapse:collapse;font-size:12px;margin-top:16px}
 th{text-align:left;background:#f1f6f5;padding:8px;border-bottom:1px solid #d8e5e2}
 td{padding:8px;border-bottom:1px solid #eef3f2}
 tfoot td{font-weight:700;border-top:2px solid #0f9b8e}
 .sched li{margin-bottom:4px;font-size:12px}
 @media print{@page{margin:16mm}}
</style></head><body>
<div class="brand"><div><h1>${escapeHtml(brand.brandName)}</h1>
<div class="muted">${escapeHtml(brand.domain)}</div></div>
<div class="muted">${en ? "Generated" : "Gegenereerd"} ${new Date().toLocaleDateString(locale)}</div></div>
<h1>${escapeHtml(trip.name)}</h1>
<div class="muted">${trip.start} ${en ? "to" : "t/m"} ${trip.end} · ${trip.stops.length} ${en ? "destinations" : "bestemmingen"}</div>
<h3>${en ? "Itinerary" : "Reisschema"}</h3><ul class="sched">${trip.itinerary
    .map(
      (i) =>
        `<li><b>${i.day}</b> — ${escapeHtml(i.title)}${i.notes ? ` <span class="muted">(${escapeHtml(i.notes)})</span>` : ""}</li>`,
    )
    .join("")}</ul>
<h3>${en ? "Expenses & claim" : "Uitgaven & declaratie"}</h3>
<table><thead><tr><th>${en ? "Date" : "Datum"}</th><th>${en ? "Description" : "Omschrijving"}</th><th>${en ? "Category" : "Categorie"}</th><th>${en ? "Original" : "Origineel"}</th><th>${base}</th><th>${en ? "Billable" : "Declarabel"}</th></tr></thead>
<tbody>${trip.expenses
    .map(
      (e) =>
        `<tr><td>${e.date}</td><td>${escapeHtml(e.title)}</td><td>${exportCategory(
          e.category,
          locale,
        )}</td><td>${e.amount.toFixed(2)} ${e.currency}</td><td>${formatMoney(
          convert(e.amount, e.currency, base, rates),
          base,
        )}</td><td>${e.billable ? (en ? "yes" : "ja") : "—"}</td></tr>`,
    )
    .join("")}</tbody>
<tfoot><tr><td colspan="4">${en ? "Total" : "Totaal"}</td><td>${formatMoney(total, base)}</td><td>${formatMoney(billable, base)}</td></tr></tfoot>
</table>
<p class="muted">${en ? "Budget" : "Budget"}: ${formatMoney(trip.budget, base)} · ${en ? "Remaining" : "Restant"}: ${formatMoney(trip.budget - total, base)}</p>
<script>window.onload=()=>window.print()</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Volledige back-up van de werkruimte als JSON */
export function downloadJson(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(name)}-backup.json`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Printklare reisgids: schema per dag, bestemmingen, paklijst en navigatielinks */
export function openGuide(
  trip: Trip,
  base: string,
  rates: Rates,
  brand: { brandName: string; domain: string },
  locale: AppLocale,
  coverUrl?: string | null,
  journal: { entry_date: string; title: string; body: string; location_name?: string | null; rating?: number | null; photo_urls?: string[]; photo_captions?: string[] }[] = [],
) {
  const en = locale === "en-GB";
  const total = trip.expenses.reduce((s, e) => s + convert(e.amount, e.currency, base, rates), 0);
  const days = [...new Set(trip.itinerary.map((i) => i.day))].sort();
  const nav = (lat: number, lon: number) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

  const html = `<!doctype html><html lang="${en ? "en" : "nl"}"><head><meta charset="utf-8">
<title>${en ? "Trip guide" : "Reisgids"} — ${escapeHtml(trip.name)}</title>
<style>
 body{font-family:ui-sans-serif,system-ui,Helvetica,Arial;margin:36px;color:#12211f}
 h1{font-size:26px;margin:0 0 4px}
 h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #d8e5e2;padding-bottom:4px}
 .muted{color:#68807c;font-size:12px}
 .cover{border-bottom:3px solid #0f9b8e;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
 ul{margin:0;padding-left:18px} li{font-size:12px;margin-bottom:4px}
 .day{margin-bottom:10px} .day b{font-size:13px}
 .grid{display:flex;flex-wrap:wrap;gap:8px}
 .chip{border:1px solid #d8e5e2;border-radius:8px;padding:6px 10px;font-size:12px}
 .journal-photos{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}.journal-photos figure{margin:0}.journal-photos img{width:100%;height:140px;object-fit:cover;border-radius:8px}.journal-photos figcaption{font-size:10px;color:#68807c;margin-top:2px}
 a{color:#0f9b8e}
 @media print{@page{margin:14mm} a{text-decoration:none}}
</style></head><body>
${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="" style="display:block;width:100%;height:240px;object-fit:cover;border-radius:14px;margin-bottom:20px">` : ""}
<div class="cover"><div><h1>${escapeHtml(trip.name)}</h1>
<div class="muted">${trip.start} ${en ? "to" : "t/m"} ${trip.end} · ${trip.stops.length} ${en ? "destinations" : "bestemmingen"} · ${en ? "budget" : "budget"} ${formatMoney(trip.budget, base)}</div></div>
<div class="muted">${escapeHtml(brand.brandName)}<br>${escapeHtml(brand.domain)}</div></div>

<h2>${en ? "Route & navigation" : "Route & navigatie"}</h2>
<div class="grid">${trip.stops
    .map(
      (s, i) =>
        `<div class="chip"><b>${i + 1}. ${escapeHtml(s.name)}</b> <span class="muted">${escapeHtml(
          localizeCountry(s.country, locale),
        )}</span><br><a href="${nav(s.lat, s.lon)}">${en ? "Navigate with Google Maps" : "Navigeer met Google Maps"}</a></div>`,
    )
    .join("")}</div>

<h2>${en ? "Day by day" : "Dag voor dag"}</h2>
${days
  .map(
    (d) =>
      `<div class="day"><b>${d}</b><ul>${trip.itinerary
        .filter((i) => i.day === d)
        .map(
          (i) =>
            `<li>${escapeHtml(i.title)}${i.notes ? ` <span class="muted">— ${escapeHtml(i.notes)}</span>` : ""}</li>`,
        )
        .join("")}</ul></div>`,
  )
  .join("")}

${
  trip.packing?.length
    ? `<h2>${en ? "Packing list" : "Paklijst"}</h2><ul>${trip.packing
        .map((p) => `<li>${p.done ? "☑" : "☐"} ${escapeHtml(p.label)}</li>`)
        .join("")}</ul>`
    : ""
}

${journal.length ? `<h2>${en ? "Travel journal" : "Reisdagboek"}</h2>${journal.map((entry)=>`<div class="day"><b>${escapeHtml(entry.entry_date)} · ${escapeHtml(entry.title)}</b>${entry.location_name ? `<p class="muted">${escapeHtml(entry.location_name)}${entry.rating ? ` · ${"★".repeat(entry.rating)}${"☆".repeat(5-entry.rating)}` : ""}</p>` : entry.rating ? `<p class="muted">${"★".repeat(entry.rating)}${"☆".repeat(5-entry.rating)}</p>` : ""}${entry.photo_urls?.length ? `<div class="journal-photos">${entry.photo_urls.slice(0,6).map((url,index)=>`<figure><img src="${escapeHtml(url)}" alt="">${entry.photo_captions?.[index] ? `<figcaption>${escapeHtml(entry.photo_captions[index])}</figcaption>` : ""}</figure>`).join("")}</div>` : ""}${entry.body?`<p class="muted">${escapeHtml(entry.body).replaceAll("\n","<br>")}</p>`:""}</div>`).join("")}` : ""}

<h2>Budget</h2>
<p class="muted">${en ? "Spent" : "Uitgegeven"} ${formatMoney(total, base)} ${en ? "of" : "van"} ${formatMoney(trip.budget, base)} · ${en ? "remaining" : "restant"} ${formatMoney(
    trip.budget - total,
    base,
  )}</p>
<script>window.onload=()=>window.print()</script>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(trip.name)}-${en ? "trip-guide" : "reisgids"}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return true;
}

/** Voorkom dat spreadsheetprogramma's gebruikersinvoer als formule uitvoeren. */
export function csvCell(value: unknown) {
  const raw = String(value);
  const safe = /^\s*[=+\-@]/.test(raw) || /^[\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportCategory(id: string, locale: AppLocale) {
  const fallback = CATEGORIES.find((category) => category.id === id)?.label ?? id;
  if (locale === "nl-NL") return fallback;
  const labels: Record<string, string> = {
    transport: "Transport",
    lodging: "Accommodation",
    food: "Food and drink",
    activities: "Activities",
    shopping: "Shopping",
    other: "Other",
  };
  return labels[id] ?? fallback;
}
