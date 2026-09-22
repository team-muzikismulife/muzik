import { describe, it, expect } from "vitest";
import { installMode, maySuggestInstall } from "../../packages/domain/install";
const base = {
  origin: "https://muzik.example",
  configuredOrigin: "https://muzik.example",
  connected: true,
  installed: false,
  userAgent: "Chrome Android",
  prompt: false,
};
describe("installation boundaries", () => {
  it("requires exact fixed HTTPS and a configured service", () => {
    for (const patch of [
      { origin: "https://preview.example" },
      { configuredOrigin: "" },
      { connected: false },
      { configuredOrigin: "http://muzik.example" },
      { configuredOrigin: "https://muzik.example/path" },
    ])
      expect(installMode({ ...base, ...patch, prompt: true })).toBe(
        "unavailable",
      );
  });
  it("distinguishes supported, unsupported, iPhone, embedded and installed", () => {
    expect(installMode(base)).toBe("manual");
    expect(installMode({ ...base, prompt: true })).toBe("prompt");
    expect(installMode({ ...base, userAgent: "iPhone Safari" })).toBe("ios");
    expect(installMode({ ...base, userAgent: "iPhone Safari KAKAOTALK" })).toBe(
      "embedded",
    );
    expect(installMode({ ...base, installed: true })).toBe("installed");
  });
  it("suggests only after a saved track, once, respecting seven-day dismissal", () => {
    const now = 8 * 86400000;
    expect(maySuggestInstall(false, false, 0, now)).toBe(false);
    expect(maySuggestInstall(true, true, 0, now)).toBe(false);
    expect(maySuggestInstall(true, false, 2 * 86400000, now)).toBe(false);
    expect(maySuggestInstall(true, false, 86400000, now)).toBe(true);
  });
});
