import { describe, it, expect } from "vitest";
import { GET } from "../app/api/swagger/route";

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
});
