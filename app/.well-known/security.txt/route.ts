// RFC 9116 security.txt, based on the repository's SECURITY.md.
// Expires must be renewed before it passes (RFC 9116 advises less than a year ahead).
export const SECURITY_TXT_EXPIRES = "2027-10-08T00:00:00Z";

export function GET() {
  const body = [
    "Contact: mailto:info@worth.nl",
    `Expires: ${SECURITY_TXT_EXPIRES}`,
    "Preferred-Languages: en, nl",
    "Policy: https://github.com/Worth-NL/verification-service/security/policy",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
