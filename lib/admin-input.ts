export function createSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function trackRuntimeToSeconds(value: string): number {
  const trimmed = value.trim();
  const parts = trimmed.split(":").map(Number);

  if (
    parts.length !== 2 ||
    parts.some((part) => Number.isNaN(part)) ||
    parts[0] < 0 ||
    parts[1] < 0 ||
    parts[1] > 59
  ) {
    throw new Error(`Invalid track runtime: "${value}". Use M:SS.`);
  }

  return parts[0] * 60 + parts[1];
}