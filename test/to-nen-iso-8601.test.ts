import { describe, it, expect } from "vitest";
import { toNenIso8601 } from "../lib/nen-iso-8601";

describe("toNenIso8601", () => {
  it("produces a NEN-ISO 8601 string with an explicit numeric offset", () => {
    const out = toNenIso8601(new Date());
    expect(out).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/
    );
  });

  it("renders the local wall-clock components of the given instant", () => {
    const d = new Date(2026, 0, 5, 14, 32, 41); // local time, month is 0-based
    const out = toNenIso8601(d);
    expect(out.startsWith("2026-01-05T14:32:41")).toBe(true);
  });

  it("zero-pads every field", () => {
    const d = new Date(2026, 8, 3, 4, 5, 6);
    expect(toNenIso8601(d).startsWith("2026-09-03T04:05:06")).toBe(true);
  });

  it("round-trips back to the same instant (to the second)", () => {
    const d = new Date(2026, 5, 30, 23, 59, 7);
    const parsed = new Date(toNenIso8601(d));
    expect(Math.abs(parsed.getTime() - d.getTime())).toBeLessThan(1000);
  });

  it("matches the offset the platform reports for that date", () => {
    const d = new Date(2026, 6, 1, 12, 0, 0);
    const offsetMinutes = -d.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const hh = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, "0");
    const mm = String(Math.abs(offsetMinutes) % 60).padStart(2, "0");
    expect(toNenIso8601(d).endsWith(`${sign}${hh}:${mm}`)).toBe(true);
  });
});
