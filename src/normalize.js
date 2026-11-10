export const LAYOUT_MODIFIED = 'Layout_Modified';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDate(value) {
  if (!value || value === LAYOUT_MODIFIED) return null;
  const source = value.replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*/gi, '').replace(/\s+/g, ' ').trim();
  if (ISO_DATE.test(source)) {
    const dt = new Date(source + 'T00:00:00.000Z');
    return Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== source ? null : source;
  }
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function getPriceChangeDate(text) {
  if (!text || text === LAYOUT_MODIFIED) return null;
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return parseDate(iso[0]);
  const date = text.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2},?\s+\d{4}\b/i);
  return date ? parseDate(date[0].replace(/\./g, '')) : null;
}

export function parseCapacity(text) {
  if (!text || text === LAYOUT_MODIFIED) return { percent_full: null, slots_left: null, tier_closed: null };
  const pct = text.match(/(\d{1,3})\s*%\s*(?:full|filled|booked)/i);
  const slots = text.match(/(\d[\d,]*)\s*(?:slots?|spots?|places?)\s*(?:left|remaining)/i);
  const tier = /\b(?:tier\s*(?:is\s*)?(?:closed|sold\s*out)|sold\s*out)\b/i.test(text);
  return {percent_full: pct ? Number(pct[1]) : null, slots_left: slots ? Number(slots[1].replaceAll(',', '')) : null, tier_closed: tier || null};
}

export function getEventStatus(dateIso, statusText, asOf) {
  if (/registration\s+(?:is\s+)?closed|registration\s+ended|event\s+closed/i.test(statusText || '')) return 'Expired/Closed';
  if (dateIso && dateIso < asOf) return 'Expired/Closed';
  if (dateIso) return 'Open';
  return LAYOUT_MODIFIED;
}

export function easternToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
  const d = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${d.year}-${d.month}-${d.day}`;
}
