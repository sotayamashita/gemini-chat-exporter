/**
 * Pads a numeric value to two digits.
 */
const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Formats a local ISO-8601 timestamp with timezone offset.
 *
 * @param date - The date to format (defaults to now).
 * @returns ISO-8601 timestamp string with local offset.
 */
export function getLocalIsoTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = pad(Math.floor(absOffset / 60));
  const offsetMins = pad(absOffset % 60);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${offsetHours}:${offsetMins}`;
}
