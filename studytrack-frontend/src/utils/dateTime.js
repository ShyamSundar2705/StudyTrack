export function combineDateAndTime(date, hours, minutes) {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function formatTime12h(hours, minutes) {
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, '0');
  return `${h}:${m} ${period}`;
}

export function formatDateLabel(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function getDefaultStartTime() {
  const d = new Date(Date.now() - 3600000);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

export function getDefaultEndTime() {
  const d = new Date();
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatRecurringLabel(days) {
  if (!days || days.length === 0) return ''
  const sorted = [...days].sort((a, b) => a - b)
  if (sorted.length === 7) return 'Every day'
  if (sorted.length === 5 && sorted.join(',') === '1,2,3,4,5') return 'Weekdays'
  if (sorted.length === 2 && sorted.join(',') === '0,6') return 'Weekends'
  if (sorted.length === 1) return `Every ${DAY_ABBR[sorted[0]]}`
  return sorted.map(d => DAY_ABBR[d]).join(', ')
}
