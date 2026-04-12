/**
 * Determines whether the current time falls within the user-defined peak hours.
 *
 * Peak hours are defined by:
 *  - start / end  — "HH:MM" strings
 *  - days         — array of weekday numbers where 0 = Sunday, 1 = Monday, … 6 = Saturday
 */
export function isInPeakHours(peakConfig, now = new Date()) {
  if (!peakConfig?.enabled) return false;

  const { start, end, days } = peakConfig;
  const currentDay = now.getDay();
  if (!days.includes(currentDay)) return false;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  const current = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  if (startMin <= endMin) {
    return current >= startMin && current < endMin;
  }
  // Overnight range (e.g. 22:00 – 06:00)
  return current >= startMin || current < endMin;
}

export function formatPeakStatus(peakConfig, now = new Date()) {
  const inPeak = isInPeakHours(peakConfig, now);
  if (!peakConfig?.enabled) return { inPeak: false, label: 'Peak tracking off', icon: '○' };

  if (inPeak) {
    return { inPeak: true, label: 'Peak hours active', icon: '⚡' };
  }
  return { inPeak: false, label: 'Off-peak — save by acting now', icon: '✦' };
}

export function minutesUntilChange(peakConfig, now = new Date()) {
  if (!peakConfig?.enabled) return null;

  const { start, end } = peakConfig;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);

  const current = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;

  const inPeak = isInPeakHours(peakConfig, now);

  if (inPeak) {
    const diff = endMin > current ? endMin - current : 1440 - current + endMin;
    return { minutes: diff, nextLabel: 'Off-peak in' };
  } else {
    const diff = startMin > current ? startMin - current : 1440 - current + startMin;
    return { minutes: diff, nextLabel: 'Peak in' };
  }
}
