import { describe, it, expect } from "vitest";
import { formatDuration } from "../duration";

describe("formatDuration", () => {
  it("formats seconds under 60", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(1000)).toBe("1s");
    expect(formatDuration(45000)).toBe("45s");
    expect(formatDuration(59000)).toBe("59s");
  });

  it("formats minutes under 60", () => {
    expect(formatDuration(60000)).toBe("1m");
    expect(formatDuration(45 * 60 * 1000)).toBe("45m");
    expect(formatDuration(59 * 60 * 1000)).toBe("59m");
  });

  it("formats hours with minutes", () => {
    expect(formatDuration(60 * 60 * 1000)).toBe("1h");
    expect(formatDuration((2 * 60 + 14) * 60 * 1000)).toBe("2h 14m");
    expect(formatDuration(23 * 60 * 60 * 1000)).toBe("23h");
  });

  it("formats hours without minutes when exact", () => {
    expect(formatDuration(3 * 60 * 60 * 1000)).toBe("3h");
  });

  it("formats days", () => {
    expect(formatDuration(24 * 60 * 60 * 1000)).toBe("1d");
    expect(formatDuration(3 * 24 * 60 * 60 * 1000)).toBe("3d");
    expect(formatDuration(10 * 24 * 60 * 60 * 1000)).toBe("10d");
  });
});
