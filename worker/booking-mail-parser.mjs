const clean = (value, max = 300) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
const first = (text, patterns) => {
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    if (hit?.[1]) return clean(hit[1], 120);
  }
  return undefined;
};
const labelled = (text, labels, pattern = "[^\\n|]{2,100}") =>
  first(
    text,
    labels.map((label) => new RegExp(`(?:${label})\\s*[:#-]\\s*(${pattern})`, "i")),
  );

const monthNumbers = {
  january: 1,
  januari: 1,
  february: 2,
  februari: 2,
  march: 3,
  maart: 3,
  april: 4,
  may: 5,
  mei: 5,
  june: 6,
  juni: 6,
  july: 7,
  juli: 7,
  august: 8,
  augustus: 8,
  september: 9,
  october: 10,
  oktober: 10,
  november: 11,
  december: 12,
};
const mailDatePattern =
  "(?:20\\d{2}-\\d{2}-\\d{2}|\\d{1,2}[/-]\\d{1,2}[/-]20\\d{2}|\\d{1,2}\\s+(?:" +
  Object.keys(monthNumbers).join("|") +
  ")\\s+20\\d{2})";
function normalizedMailDate(raw) {
  if (!raw) return undefined;
  const value = clean(raw, 80).toLowerCase();
  let iso = value;
  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](20\d{2})$/);
  const named = value.match(/^(\d{1,2})\s+([a-z]+)\s+(20\d{2})$/);
  if (numeric)
    iso = numeric[3] + "-" + numeric[2].padStart(2, "0") + "-" + numeric[1].padStart(2, "0");
  if (named && monthNumbers[named[2]])
    iso =
      named[3] +
      "-" +
      String(monthNumbers[named[2]]).padStart(2, "0") +
      "-" +
      named[1].padStart(2, "0");
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso
    ? iso
    : undefined;
}
function flightItinerary(text) {
  const events = [];
  const timestamps = new RegExp(
    "(" + mailDatePattern + ")\\s*(?:[-–,]|om|at)?\\s*((?:[01]?\\d|2[0-3]):[0-5]\\d)",
    "gi",
  );
  for (const hit of text.matchAll(timestamps)) {
    const date = normalizedMailDate(hit[1]);
    if (!date) continue;
    const location = text
      .slice(hit.index + hit[0].length)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length);
    if (!location || !/[,\s(][A-Z]{3}\)?$/.test(location)) continue;
    events.push({
      index: hit.index,
      date,
      time: hit[2].padStart(5, "0"),
      location: clean(location, 120),
    });
  }
  const flights = [];
  const usedEvents = new Set();
  const numbers =
    /^\s*(?:(?:flight|vlucht)\s*[:#-]?\s*)?([A-Z0-9]{2}\s?\d{2,4})(?=\s*(?:\||$|(?:operated|uitgevoerd)\b))/gim;
  const flightMatches = [...text.matchAll(numbers)];
  for (const [index, hit] of flightMatches.entries()) {
    const before = events.filter((event) => event.index < hit.index).at(-1);
    const after = events.find((event) => event.index > hit.index + hit[0].length);
    if (
      !before ||
      !after ||
      usedEvents.has(before.index) ||
      after.date < before.date ||
      (flightMatches[index + 1] && after.index > flightMatches[index + 1].index)
    )
      continue;
    usedEvents.add(before.index);
    usedEvents.add(after.index);
    flights.push({
      flightNumber: hit[1].replace(/\s/g, "").toUpperCase(),
      date: before.date,
      endDate: after.date,
      startTime: before.time,
      endTime: after.time,
      departureName: before.location,
      arrivalName: after.location,
    });
    if (flights.length === 12) break;
  }
  return flights;
}
function bookingProvider(text, subject, sender) {
  const issuedBy = labelled(text, [
    "uitgegeven door",
    "issued by",
    "luchtvaartmaatschappij",
    "aanbieder",
  ]);
  if (issuedBy) return /^KLM\b/i.test(issuedBy) ? "KLM" : clean(issuedBy, 80);
  if (/\b(?:vertrouwen in KLM|thank you for (?:choosing|flying) KLM)\b/i.test(text)) return "KLM";
  const forwarded =
    /^(?:fwd?|doorsturen)\s*:/i.test(subject.trim()) ||
    /(?:begin forwarded message|forwarded message|doorgestuurd bericht)/i.test(text);
  return forwarded ? undefined : clean(sender.split("@")[1]?.split(".")[0] || "", 80) || undefined;
}
function completeness(bookingType, data) {
  const fields =
    bookingType === "flight"
      ? [
          "provider",
          "bookingReference",
          "flightNumber",
          "date",
          "endDate",
          "startTime",
          "endTime",
          "departureName",
          "arrivalName",
        ]
      : ["provider", "bookingReference", "date"];
  return Math.min(
    0.98,
    0.2 + (0.78 * fields.filter((key) => Boolean(data[key])).length) / fields.length,
  );
}

export function parseBookingMail({ subject = "", body = "", sender = "" }) {
  const text = String(`${subject}\n${body}`).replace(/\0/g, "").slice(0, 20000),
    lower = text.toLowerCase();
  let bookingType = "unknown";
  if (/\b(rental car|huurauto|car rental|autohuur)\b/.test(lower)) bookingType = "car_rental";
  else if (/\b(flight|vlucht|boarding|airline)\b/.test(lower)) bookingType = "flight";
  else if (/\b(hotel|hostel|accommodation|verblijf|check-in|room)\b/.test(lower))
    bookingType = "lodging";
  else if (/\b(train|trein|bus|ferry|transfer|transport)\b/.test(lower)) bookingType = "transport";
  else if (/\b(activity|activiteit|tour|ticket|excursion)\b/.test(lower)) bookingType = "activity";
  const bookingReference = first(text, [
    /\b(?:boekingscode|reserveringscode|reserveringsnummer|booking code|reservation code)\s*[:#-]\s*([A-Z0-9-]{4,24})/i,
    /(?:booking|reservation|confirmation|boekings)(?:\s+(?:reference|number|nummer))?\s*[:#-]\s*([A-Z0-9-]{4,24})/i,
    /(?:PNR)\s*[:#-]\s*([A-Z0-9]{4,12})/i,
  ]);
  const flightNumber =
    bookingType === "flight" ? first(text, [/\b([A-Z]{2,3}\s?\d{2,4})\b/]) : undefined;
  const allDates = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]20\d{2})\b/g)].map(
    (hit) => clean(hit[1], 10),
  );
  const date =
    labelled(
      text,
      ["departure date", "vertrekdatum", "check-in", "pickup date", "ophaaldatum"],
      "(?:20\\d{2}-\\d{2}-\\d{2}|\\d{2}[/-]\\d{2}[/-]20\\d{2})",
    ) || allDates[0];
  const endDate =
    labelled(
      text,
      ["arrival date", "aankomstdatum", "check-out", "return date", "inleverdatum"],
      "(?:20\\d{2}-\\d{2}-\\d{2}|\\d{2}[/-]\\d{2}[/-]20\\d{2})",
    ) || allDates[1];
  const startTime = labelled(
    text,
    ["departure time", "vertrektijd", "check-in time", "pickup time", "ophaaltijd"],
    "[0-2]?\\d:[0-5]\\d",
  );
  const endTime = labelled(
    text,
    ["arrival time", "aankomsttijd", "check-out time", "return time", "inlevertijd"],
    "[0-2]?\\d:[0-5]\\d",
  );
  const departureName = labelled(text, ["from", "departure", "vertrek", "origin"]);
  const arrivalName = labelled(text, ["to", "arrival", "aankomst", "destination", "bestemming"]);
  const locationName = labelled(text, [
    "hotel",
    "accommodation",
    "verblijf",
    "location",
    "locatie",
    "venue",
  ]);
  const provider = bookingProvider(text, subject, sender);
  const statusText = text
    .split(
      /(?:belangrijk om te weten|het gebruiken, wijzigen of annuleren|terms and conditions|ticket conditions)/i,
    )[0]
    .replace(
      /[^\n]*(?:free cancellation|gratis annulering|cancellation policy|annuleringsvoorwaarden|cancellation fee|annuleringskosten)[^\n]*/gi,
      "",
    );
  const changeKind =
    /\b(cancelled|canceled|geannuleerd)\b/i.test(statusText) ||
    /\b(annulering|cancellation)\b/i.test(subject)
      ? "cancelled"
      : /\b(changed|wijziging|gewijzigd|updated)\b/i.test(statusText)
        ? "changed"
        : "new";
  const parsedData = {
    title: clean(subject, 160) || "Imported booking",
    provider,
    bookingReference,
    flightNumber,
    date,
    changeKind,
  };
  Object.keys(parsedData).forEach((k) => parsedData[k] === undefined && delete parsedData[k]);
  Object.assign(parsedData, {
    endDate,
    startTime,
    endTime,
    departureName,
    arrivalName,
    locationName,
  });
  Object.keys(parsedData).forEach((k) => parsedData[k] === undefined && delete parsedData[k]);
  const segments = bookingType === "flight" ? flightItinerary(text) : [];
  const bookings = segments.length
    ? segments.map((segment) => {
        const data = {
          ...parsedData,
          ...segment,
          title: [
            provider,
            segment.flightNumber,
            segment.departureName + " → " + segment.arrivalName,
          ]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 160),
        };
        return { bookingType, parsedData: data, confidence: completeness(bookingType, data) };
      })
    : [{ bookingType, parsedData, confidence: completeness(bookingType, parsedData) }];
  return { ...bookings[0], bookings };
}
