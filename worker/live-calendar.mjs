function icsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value.replaceAll("-", "")
    : null;
}

function afterDay(value) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function foldLine(line) {
  const result = [];
  let segment = "";
  let bytes = 0;
  for (const character of line) {
    const width = Buffer.byteLength(character);
    if (bytes + width > 75) {
      result.push(segment);
      segment = " ";
      bytes = 1;
    }
    segment += character;
    bytes += width;
  }
  result.push(segment);
  return result.join("\r\n");
}

function validTime(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value ?? ""))) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours < 24 && minutes < 60 ? value.replace(":", "") : null;
}

function nextHour(day, time) {
  const date = new Date(`${day}T${time.slice(0, 2)}:${time.slice(2)}:00Z`);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.toISOString().replace(/[-:]/g, "").slice(0, 15);
}

export function buildLiveCalendar(calendar, now = new Date()) {
  const modified = new Date(calendar.updated_at ?? now);
  const stamp = (Number.isFinite(modified.getTime()) ? modified : now).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const events = [
    ...(calendar.itinerary ?? []).map((item) => ({
      id: `itinerary-${item.id}`, day: item.day, end: item.day,
      title: item.title, notes: item.notes,
    })),
    ...(calendar.bookings ?? []).map((item) => ({
      id: `booking-${item.id}`, day: item.start_date, end: item.end_date,
      title: item.title, notes: item.notes,
      startTime: item.details?.startTime, endTime: item.details?.endTime,
      location: item.location?.name ?? item.departure?.name ?? item.arrival?.name,
      allDay: ["lodging", "car_rental"].includes(item.item_type),
    })),
  ];
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GlobeTrotr//Live trip calendar//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-PUBLISHED-TTL:PT5M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT5M", `X-WR-CALNAME:${icsText(calendar.name)}`,
  ];
  for (const event of events) {
    const day = icsDate(event.day);
    if (!day) continue;
    const endDay = icsDate(event.end) ? event.end : event.day;
    const startTime = validTime(event.startTime);
    const endTime = validTime(event.endTime);
    lines.push("BEGIN:VEVENT", `UID:${icsText(event.id)}@globetrotr.nl`, `DTSTAMP:${stamp}`);
    if (startTime && !event.allDay) {
      lines.push(`DTSTART:${day}T${startTime}00`);
      const suppliedEnd = endTime ? `${icsDate(endDay)}T${endTime}00` : null;
      lines.push(`DTEND:${suppliedEnd && suppliedEnd > `${day}T${startTime}00` ? suppliedEnd : nextHour(event.day, startTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${afterDay(endDay)}`);
    }
    lines.push(`LAST-MODIFIED:${stamp}`, "STATUS:CONFIRMED", `TRANSP:${event.allDay ? "TRANSPARENT" : "OPAQUE"}`);
    lines.push(`SUMMARY:${icsText(event.title)}`);
    if (event.notes) lines.push(`DESCRIPTION:${icsText(event.notes)}`);
    if (event.location) lines.push(`LOCATION:${icsText(event.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR", "");
  return lines.map(foldLine).join("\r\n");
}
