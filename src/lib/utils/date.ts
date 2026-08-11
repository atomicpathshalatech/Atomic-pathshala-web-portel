import { format } from "date-fns";

export function formatDate(date: Date): string {
  return format(date, "d MMM yyyy");
}

/**
 * The ID card's "Valid Until" is derived from the current academic session
 * (India: April–March), not invented — it's always 31 March of the session
 * the card is being viewed in. This intentionally does NOT read any stored
 * expiry field since none exists yet in the schema.
 */
export function currentAcademicSessionEnd(): Date {
  const now = new Date();
  const year = now.getMonth() >= 3 /* April = index 3 */ ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, 2, 31); // 31 March
}

export function academicSessionLabel(): string {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}
