// lib/auth/identifier.ts
// WHAT IT'S FOR: people log in with an email OR a phone number. This works out which one was
// typed and puts it in the stored format: emails in lowercase, US phone numbers as E.164
// (+15550101234), the format the users table keeps.
// WHO USES IT: app/api/auth/login/route.ts and scripts/demo-seed.ts. Tested by lib/auth/auth.test.ts.
// WHY THE NAME: the login "identifier"; ".ts" = no screen code.

export type Identifier = { kind: "email"; value: string } | { kind: "phone"; value: string };

// Returns the cleaned email or phone, or null if it's neither.
export function parseIdentifier(input: string): Identifier | null {
  const text = input.trim();
  if (text.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? { kind: "email", value: text.toLowerCase() } : null;
  }
  const phone = normalizePhone(text);
  return phone ? { kind: "phone", value: phone } : null;
}

// "(555) 010-1234", "555.010.1234" or "+1 555 010 1234" -> "+15550101234". Null if not a phone.
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}
