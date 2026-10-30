import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { GET } from "../app/api/swagger/route";
import packageJson from "../package.json";

/**
 * Every HTTP status a route handler can return, read from its source:
 * `status: 400` literals and the `? 201 : 200` ternary in the create route.
 */
const statusesInRoute = (file: string) => {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const codes = new Set<string>();
  for (const m of source.matchAll(/status:\s*([1-5]\d\d)\b/g)) codes.add(m[1]);
  for (const m of source.matchAll(/\?\s*([1-5]\d\d)\s*:\s*([1-5]\d\d)\b/g)) {
    codes.add(m[1]);
    codes.add(m[2]);
  }
  return [...codes].sort();
};

describe("GET /api/swagger", () => {
  it("returns a 200 JSON response", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("serves an OpenAPI 3 document describing both endpoints", async () => {
    const spec = await (await GET()).json();

    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info.title).toBe("Verification Requests API");
    expect(Object.keys(spec.paths)).toEqual([
      "/verification-requests",
      "/verification-requests/verify",
    ]);
    expect(spec.paths["/verification-requests"].post).toBeDefined();
    expect(spec.paths["/verification-requests/verify"].post).toBeDefined();
  });

  it("marks the create body as oneOf email/phoneNumber", async () => {
    const spec = await (await GET()).json();
    const schema =
      spec.paths["/verification-requests"].post.requestBody.content[
        "application/json"
      ].schema;
    expect(schema.oneOf).toEqual([
      { required: ["email"] },
      { required: ["phoneNumber"] },
    ]);
  });

  it("reports the package version", async () => {
    const spec = await (await GET()).json();
    expect(spec.info.version).toBe(packageJson.version);
  });

  it.each([
    ["/verification-requests", "app/api/verification-requests/route.ts"],
    ["/verification-requests/verify", "app/api/verification-requests/verify/route.ts"],
  ])("documents exactly the statuses %s can return", async (path, file) => {
    const spec = await (await GET()).json();
    const documented = Object.keys(spec.paths[path].post.responses).sort();
    const returned = statusesInRoute(file);

    expect(returned.length).toBeGreaterThan(0);
    expect(documented).toEqual(returned);
  });

  it("documents both 400 bodies of the verify route", async () => {
    const spec = await (await GET()).json();
    const schema =
      spec.paths["/verification-requests/verify"].post.responses["400"].content[
        "application/json"
      ].schema;
    expect(schema.oneOf).toEqual([
      { $ref: "#/components/schemas/ErrorResponse" },
      { $ref: "#/components/schemas/VerificationFailedResponse" },
    ]);
  });
});
