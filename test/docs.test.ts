import { describe, expect, it } from "vitest";

import { useTestApp } from "./helpers.js";

describe("API docs", () => {
  const context = useTestApp();

  it("serves the OpenAPI document with every public route", async () => {
    const response = await context.app.inject({
      method: "GET",
      url: "/swagger.json",
    });

    expect(response.statusCode).toBe(200);
    expect(Object.keys(response.json().paths)).toEqual(
      expect.arrayContaining([
        "/",
        "/api/health",
        "/api/shorten",
        "/{shortCode}",
      ]),
    );
  });

  it("serves the Scalar reference page", async () => {
    const entry = await context.app.inject({ method: "GET", url: "/docs" });
    expect(entry.statusCode).toBe(301);
    expect(entry.headers.location).toBe("/docs/");

    const response = await context.app.inject({ method: "GET", url: "/docs/" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["content-security-policy"]).toBeUndefined();
  });
});
