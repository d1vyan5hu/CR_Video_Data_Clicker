// Builds the same column set the server's CSV export would use, so the
// in-app preview matches the downloaded file exactly.
export function collectFieldIds(annotations) {
  const ids = new Set();
  annotations.forEach((a) => Object.keys(a.fields || {}).forEach((k) => ids.add(k)));
  return Array.from(ids);
}

export function buildPreviewRows(annotations, limit = 10) {
  const fieldIds = collectFieldIds(annotations);
  const rows = annotations.slice(0, limit).map((a) => ({
    timestamp: a.timestamp,
    x: a.x,
    y: a.y,
    ...fieldIds.reduce((acc, id) => ({ ...acc, [id]: a.fields?.[id] ?? '' }), {})
  }));
  return { fieldIds, rows };
}

export function formatTimestamp(seconds) {
  if (seconds === undefined || seconds === null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

// Parses "7:00:00 AM" or "07:00:00" (24hr) into seconds since midnight.
// Returns null if the string can't be parsed.
export function parseClockTime(str) {
  if (!str) return null;
  const trimmed = str.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (ampmMatch) {
    let [, h, m, s, period] = ampmMatch;
    h = Number(h) % 12;
    if (/pm/i.test(period)) h += 12;
    return h * 3600 + Number(m) * 60 + Number(s || 0);
  }
  const plain = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (plain) {
    const [, h, m, s] = plain;
    return Number(h) * 3600 + Number(m) * 60 + Number(s || 0);
  }
  return null;
}
