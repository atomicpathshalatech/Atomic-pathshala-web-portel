import type { Metadata } from "next";
import { GrievanceOfficer, LEGAL, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — Atomic Pathshala",
  description: "How Atomic Pathshala collects, uses, stores and protects your information, including our use of YouTube API Services.",
  alternates: { canonical: `${LEGAL.site}/privacy` },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <>
          <p>
            This Privacy Policy explains how {LEGAL.company} (&quot;{LEGAL.brand}&quot;, &quot;we&quot;, &quot;us&quot;) collects, uses, stores and
            protects information when you use our website {LEGAL.site}, our mobile app and our related services (together, the
            &quot;Platform&quot;). By using the Platform you agree to this policy.
          </p>
        </>
      }
      sections={[
        {
          id: "information",
          title: "Information we collect",
          body: (
            <>
              <p><b>Information you give us</b> when you register or use the Platform:</p>
              <ul>
                <li>Name, father&apos;s and mother&apos;s name, email address, mobile number, date of birth and gender;</li>
                <li>Class, target exam, school, city, state and address; optional photo, blood group and emergency contact;</li>
                <li>Password (stored only in encrypted/hashed form) and your security question for password recovery;</li>
                <li>Questions, doubts, messages, feedback and files you send us.</li>
              </ul>
              <p><b>Information created while you study:</b> enrolled batches, classes attended, test and DPP attempts, answers, scores, progress and bookmarks.</p>
              <p><b>Technical information:</b> device and browser type, app version, IP address, login sessions and the notification token of your device (used to send you class and test alerts).</p>
              <p><b>Payments:</b> fees may be paid offline (cash, UPI or bank transfer, recorded by our staff with a receipt) or, where offered, online. Online payments are processed by a third-party payment gateway; we receive only the payment status and reference, never your full card or bank details.</p>
            </>
          ),
        },
        {
          id: "use",
          title: "How we use your information",
          body: (
            <ul>
              <li>To create and manage your account and give you access to the batches you are enrolled in;</li>
              <li>To run live classes, recorded lectures, tests, DPPs, results and rankings;</li>
              <li>To send you schedules, reminders, results and important notices (in-app, push notification, SMS, email or WhatsApp);</li>
              <li>To answer your doubts and support requests, including with AI tools that help our teachers;</li>
              <li>To keep the Platform secure, prevent misuse and meet legal requirements;</li>
              <li>To improve our teaching and the Platform.</li>
            </ul>
          ),
        },
        {
          id: "youtube",
          title: "YouTube API Services",
          body: (
            <>
              <p>
                The Platform uses <b>YouTube API Services</b> to run and show our live classes and recorded lectures. Our live classes are
                streamed as <b>unlisted</b> broadcasts on our own YouTube channel and shown to enrolled students inside the Platform through
                the embedded YouTube player.
              </p>
              <p>
                By watching classes on the Platform you are also agreeing to be bound by the{" "}
                <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>. YouTube is a
                Google service; please see the{" "}
                <a href="http://www.google.com/policies/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a> for how
                Google handles information when you use the YouTube player.
              </p>
              <p><b>What we access through YouTube API Services:</b></p>
              <ul>
                <li>Only our own YouTube channel is connected (by our staff, through Google sign-in). Students are never asked to connect a YouTube or Google account.</li>
                <li>We create, start and end live broadcasts and streams for our classes, read the live chat of our own broadcasts so the teacher can see students&apos; questions, and read the status, duration and view counts of our own videos.</li>
                <li>We do not access, collect or store any information about students&apos; YouTube or Google accounts.</li>
              </ul>
              <p><b>What we store:</b> the IDs of our broadcasts, streams and videos, their live/recording status and view counts, linked to the class they belong to. Live chat messages read from YouTube are shown to the teacher during class and are not stored in our database.</p>
              <p><b>How long:</b> this data is kept while the class or lecture exists on the Platform and is deleted with it. Cached YouTube data is refreshed or removed within 30 days.</p>
              <p>
                <b>Revoking access:</b> the channel owner can remove the Platform&apos;s access to YouTube at any time from the Google security
                settings page:{" "}
                <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer">
                  https://security.google.com/settings/security/permissions
                </a>
                . After access is removed the Platform can no longer make YouTube API requests for that channel. To have the stored
                YouTube data deleted as well, write to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.
              </p>
            </>
          ),
        },
        {
          id: "sharing",
          title: "Sharing of information",
          body: (
            <>
              <p>We do not sell your personal information. We share it only:</p>
              <ul>
                <li>With your teachers and our staff, to teach and support you;</li>
                <li>With a parent or guardian linked to a student account;</li>
                <li>With service providers who run parts of the Platform for us (cloud hosting and storage, database, video and live-class services including YouTube, online payment processing where offered, SMS/email/WhatsApp and push-notification delivery, and AI services) — only for that purpose;</li>
                <li>When required by law, a court order or a government authority, or to protect the safety of our users.</li>
              </ul>
              <p>Your rank and score may be shown to other students of your batch on leaderboards.</p>
            </>
          ),
        },
        {
          id: "storage",
          title: "Storage, security and retention",
          body: (
            <>
              <p>
                Your information is stored on secure cloud servers. Passwords are hashed, connections use HTTPS, and access is limited to
                authorised staff by role. No system is completely secure, but we take reasonable steps to protect your data.
              </p>
              <p>
                We keep your information while your account is active and as long as needed for the purposes above, for our records of
                fees and results, and as required by law. When it is no longer needed it is deleted or anonymised.
              </p>
            </>
          ),
        },
        {
          id: "rights",
          title: "Your choices and rights",
          body: (
            <>
              <ul>
                <li>You can see and update your profile details in the app.</li>
                <li>You can turn off push notifications in your device settings.</li>
                <li>You can ask us to correct your information or to delete your account and data by writing to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. We will reply within 30 days. Some records (for example fee receipts) may be kept where the law requires.</li>
              </ul>
            </>
          ),
        },
        {
          id: "children",
          title: "Students under 18",
          body: (
            <p>
              Many of our students are under 18. A student under 18 should use the Platform with the consent of a parent or guardian, who
              may contact us at any time about the student&apos;s information.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: <p>We may update this policy from time to time. The new version will be posted on this page with its &quot;Last updated&quot; date.</p>,
        },
        {
          id: "contact",
          title: "Contact and grievance officer",
          body: (
            <>
              <p>
                For any question or complaint about your information, contact our Grievance Officer (under the Information Technology Act,
                2000 and the rules made under it). We will acknowledge your complaint within 24 hours and resolve it within 15 days.
              </p>
              <GrievanceOfficer />
            </>
          ),
        },
      ]}
    />
  );
}
