import { describe, expect, it } from "vitest";

import { decodeShortCode, encodeId, hashids } from "../src/lib/hashids.js";

describe("hashids", () => {
  it("round-trips an ID through its short code", () => {
    const shortCode = encodeId(238_328);

    expect(shortCode).toMatch(/^[0-9a-zA-Z]{4,}$/);
    expect(decodeShortCode(shortCode)).toBe(238_328);
  });

  it.each([
    ["characters outside the alphabet", "abc-123"],
    ["an empty-looking code", "0"],
  ])("returns null for %s", (_description, shortCode) => {
    expect(decodeShortCode(shortCode)).toBeNull();
  });

  it("returns null for codes carrying more than one number", () => {
    expect(decodeShortCode(hashids.encode(1, 2))).toBeNull();
  });
});
