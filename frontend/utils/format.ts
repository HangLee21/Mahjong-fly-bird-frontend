export function formatScore(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function formatTime(ts: number): string {
  const date = new Date(ts);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
