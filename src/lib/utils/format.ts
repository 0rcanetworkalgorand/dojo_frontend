export function formatAlgo(microAlgo?: number | bigint | null): string {
  if (microAlgo === undefined || microAlgo === null) return "0.00";
  const value = typeof microAlgo === 'bigint' ? Number(microAlgo) : microAlgo;
  return (value / 1_000_000).toFixed(2);
}

export function formatAlgoDisplay(microAlgo: number | bigint): string {
  return `${formatAlgo(microAlgo)} ALGO`;
}

export function truncateAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatPercentage(value?: number | null): string {
  if (value === undefined || value === null) return "0.0%";
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}
