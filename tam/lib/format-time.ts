/** Short relative time for ride "posted" labels */
export function formatPostedAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
