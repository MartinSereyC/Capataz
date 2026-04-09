/**
 * Sentinel mock mode utilities.
 * When MOCK_SENTINEL=true, the full UI flow works without API credentials.
 */

export const MOCK_TOKEN = "mock-sentinel-token-dev-only";

/** Returns true when running in mock mode */
export function isMockMode(): boolean {
  return process.env.MOCK_SENTINEL === "true";
}

/**
 * Returns 12 mock dates evenly spread over the last 6 months (~every 15 days).
 * Dates are returned in ascending order (oldest first).
 */
export function getMockDates(): string[] {
  const dates: string[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 15);
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
}

/**
 * Returns synthetic cloud coverage percentages for the 12 mock dates.
 * Values vary between 5–45% to simulate realistic conditions.
 */
export function getMockCloudCoverage(): Record<string, number> {
  const dates = getMockDates();
  // Deterministic pattern: cycles through a fixed set of values
  const pattern = [8, 22, 5, 38, 15, 45, 12, 28, 6, 33, 19, 41];
  const coverage: Record<string, number> = {};

  dates.forEach((date, idx) => {
    coverage[date] = pattern[idx % pattern.length];
  });

  return coverage;
}
