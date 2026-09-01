import "server-only";

export type OutreachContact = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  studentClass: string | null;
  targetExam: string | null;
  city: string | null;
  leadSource: string;
};

export type OutreachUser = { id: string; name: string; role: string };

export type OutreachLead = {
  id: string;
  status: string;
  stage: string;
  score: number;
  targetCourse: string | null;
  targetBatch: string | null;
  isConvertedToLms: boolean;
  registrationUrl: string | null;
  createdAt: string;
  updatedAt: string;
  contact: OutreachContact;
  assignedUser: OutreachUser | null;
};

export class OutreachIntegrationError extends Error {
  constructor(message = "Could not reach the CRM (atomic-outreach-system). Check OUTREACH_APP_URL / OUTREACH_API_KEY in .env.") {
    super(message);
    this.name = "OutreachIntegrationError";
  }
}

function config() {
  const baseUrl = process.env.OUTREACH_APP_URL;
  const apiKey = process.env.OUTREACH_API_KEY;
  if (!baseUrl || !apiKey) throw new OutreachIntegrationError();
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

/**
 * Everything here is a live read/write against atomic-outreach-system's
 * own database — atomic-ops deliberately keeps no local copy of leads.
 * `assignedUserId` always refers to an outreach-system User, not an
 * atomic-ops one; the two apps have no shared user identity, so the
 * Leads page shows outreach's own counselor list for reassignment.
 */
export async function getOutreachLeads(status?: string): Promise<OutreachLead[]> {
  const { baseUrl, apiKey } = config();
  const url = new URL(`${baseUrl}/api/integrations/lms/leads`);
  if (status && status !== "ALL") url.searchParams.set("status", status);

  const res = await fetch(url, { headers: { "x-api-key": apiKey }, cache: "no-store" });
  if (!res.ok) throw new OutreachIntegrationError(`CRM returned ${res.status} while listing leads.`);
  const json = await res.json();
  return json.leads as OutreachLead[];
}

export async function getOutreachUsers(): Promise<OutreachUser[]> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}/api/integrations/lms/users`, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new OutreachIntegrationError(`CRM returned ${res.status} while listing counselors.`);
  const json = await res.json();
  return json.users as OutreachUser[];
}

export async function updateOutreachLead(
  leadId: string,
  data: { status?: string; stage?: string; assignedUserId?: string | null }
): Promise<OutreachLead> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}/api/integrations/lms/leads`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ leadId, ...data }),
  });
  if (!res.ok) throw new OutreachIntegrationError(`CRM returned ${res.status} while updating the lead.`);
  const json = await res.json();
  return json.lead as OutreachLead;
}
