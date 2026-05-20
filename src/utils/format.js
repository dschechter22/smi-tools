// n in 0-100 scale
export function fmtPct(n) {
  if (n == null) return '—';
  return `${Math.round(n)}%`;
}

// n in 0-1 scale
export function fmtRate(n) {
  if (n == null) return '—';
  return `${Math.round(n * 100)}%`;
}

export function fmt$(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}
