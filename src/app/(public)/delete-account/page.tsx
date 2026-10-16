import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LEGAL, LegalPage } from "@/components/legal/LegalPage";
import { DeleteAccountForm } from "@/components/account/DeleteAccountForm";
import { SELF_DELETE_ROLES } from "@/lib/account/deletion";

export const metadata: Metadata = {
  title: "Delete your account — Atomic Pathshala",
  description: "How to delete your Atomic Pathshala account and what data is deleted.",
  alternates: { canonical: `${LEGAL.site}/delete-account` },
};

export const dynamic = "force-dynamic";

/** Account deletion — linked from the app's Settings and from the Play Store listing. */
export default async function DeleteAccountPage() {
  const session = await getServerSession(authOptions);
  const signedIn = Boolean(session?.user?.id);
  const canSelfDelete = signedIn && SELF_DELETE_ROLES.has(session?.user?.role ?? "");

  return (
    <LegalPage
      title="Delete your account"
      intro={
        <p>
          You can delete your {LEGAL.brand} account and its personal data at any time — from the app (<b>Settings → Delete account</b>) or on
          this page.
        </p>
      }
      sections={[
        {
          id: "request",
          title: "Request deletion",
          body: (
            <DeleteAccountForm
              signedIn={signedIn}
              canSelfDelete={canSelfDelete}
              email={LEGAL.email}
            />
          ),
        },
        {
          id: "what",
          title: "What happens",
          body: (
            <ul>
              <li>Your account is switched off at once: you can&apos;t sign in any more and every device is signed out.</li>
              <li>
                Within <b>30 days</b> we delete your personal data: name, email, mobile number, photo, parents&apos; names, date of birth, school,
                address, blood group, emergency contact, password and security question, and your login devices.
              </li>
              <li>
                <b>Kept without your name:</b> fee receipts and payment records (required by accounting and tax law, kept up to 8 years) and test
                scores in rank lists. These can no longer be linked to you.
              </li>
              <li>An active batch or subscription ends with the account; fees already paid are not refunded by deleting the account.</li>
            </ul>
          ),
        },
        {
          id: "help",
          title: "Can't sign in?",
          body: (
            <p>
              Write to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> from the email or mobile number on the account with the subject
              &quot;Delete my account&quot;. We confirm it is you and delete it within 30 days.
            </p>
          ),
        },
      ]}
    />
  );
}
