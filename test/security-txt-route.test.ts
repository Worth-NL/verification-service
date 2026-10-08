import { describe, it, expect } from "vitest";
import { GET, SECURITY_TXT_EXPIRES } from "../app/.well-known/security.txt/route";

describe("GET /.well-known/security.txt", () => {
  it("returns a plain text response", () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  });

  it("points to the NotifyNL security contact and policy", async () => {
    const lines = (await GET().text()).trim().split("\n");
    expect(lines).toEqual([
      "Contact: mailto:info@worth.nl",
      `Expires: ${SECURITY_TXT_EXPIRES}`,
      "Preferred-Languages: en, nl",
      "Policy: https://github.com/Worth-NL/verification-service/security/policy",
    ]);
  });

  it("has not expired", () => {
    expect(new Date(SECURITY_TXT_EXPIRES).getTime()).toBeGreaterThan(Date.now());
  });
});
