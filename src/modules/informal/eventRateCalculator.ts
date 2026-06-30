export function calculateHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return 0;
  let start = sh + (sm || 0) / 60;
  let end = eh + (em || 0) / 60;
  if (end < start) end += 24;
  return Math.max(0, end - start);
}

export function hourlyRate(totalPay: number, hours: number): number {
  return hours > 0 ? Number((totalPay / hours).toFixed(2)) : 0;
}
