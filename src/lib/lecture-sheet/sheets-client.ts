import "server-only";
import { google } from "googleapis";

/**
 * The few Sheets operations the lecture sync needs, behind an interface so the
 * sync can be tested without Google (see scripts/test-lecture-sheet.ts).
 * Values are always written RAW (a value typed like "=..." is never run as a formula).
 */
export interface SheetsClient {
  /** Makes sure the tab exists. */
  ensureTab(tab: string): Promise<void>;
  /** Cell values of a range, e.g. "Lectures!A1:V". Missing trailing cells are "". */
  read(range: string): Promise<string[][]>;
  /** Writes several ranges in one request. */
  writeMany(data: { range: string; values: string[][] }[]): Promise<void>;
  /** Appends rows after the last filled row of the tab; returns the 1-based row number of the first appended row. */
  append(tab: string, rows: string[][]): Promise<number>;
}

export class SheetsNotConfiguredError extends Error {}

function credentials() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new SheetsNotConfiguredError("GOOGLE_SERVICE_ACCOUNT_JSON is not set on the server.");
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SheetsNotConfiguredError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }
  if (!parsed.client_email || !parsed.private_key) throw new SheetsNotConfiguredError("GOOGLE_SERVICE_ACCOUNT_JSON has no client_email / private_key.");
  return { email: parsed.client_email, key: parsed.private_key.replace(/\\n/g, "\n") };
}

/** The email the Sheet must be shared with (Editor). Never the key. */
export function serviceAccountEmail(): string | null {
  try {
    return credentials().email;
  } catch {
    return null;
  }
}

export function googleSheetsClient(spreadsheetId: string): SheetsClient {
  const { email, key } = credentials();
  const auth = new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });

  return {
    async ensureTab(tab) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties.title" });
      if (meta.data.sheets?.some((s) => s.properties?.title === tab)) return;
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
    },
    async read(range) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: "FORMATTED_VALUE" });
      return (res.data.values ?? []).map((row) => row.map((v) => (v == null ? "" : String(v))));
    },
    async writeMany(data) {
      if (data.length === 0) return;
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data } });
    },
    async append(tab, rows) {
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${tab}!A1`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: rows },
      });
      const updated = res.data.updates?.updatedRange ?? ""; // e.g. Lectures!A12:V14
      const first = Number(updated.match(/![A-Z]+(\d+)/)?.[1]);
      return Number.isFinite(first) ? first : -1;
    },
  };
}
