import type { Metadata } from "next";
import Link from "next/link";
import { GrievanceOfficer, LEGAL, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — Atomic Pathshala",
  description: "The terms for using the Atomic Pathshala website, app, live classes, tests and study material.",
  alternates: { canonical: `${LEGAL.site}/terms` },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your use of the website {LEGAL.site}, the {LEGAL.brand} mobile app and our
          related services (the &quot;Platform&quot;), run by {LEGAL.company}, {LEGAL.address}. By creating an account or using the Platform
          you agree to these Terms and to our <Link href="/privacy" className="text-blue-700 underline">Privacy Policy</Link>.
        </p>
      }
      sections={[
        {
          id: "service",
          title: "Our service",
          body: (
            <p>
              {LEGAL.brand} provides coaching for NEET, JEE and school exams: live and recorded classes, notes and modules, tests, daily
              practice problems (DPPs), doubt solving and related tools. Batches, schedules and content may change from time to time.
            </p>
          ),
        },
        {
          id: "account",
          title: "Your account",
          body: (
            <ul>
              <li>Give correct details when you register and keep them up to date.</li>
              <li>Keep your password secret. You are responsible for activity on your account.</li>
              <li>An account is for one student only and must not be shared or sold. We may limit the number of devices or logins.</li>
              <li>A student under 18 should use the Platform with the consent of a parent or guardian.</li>
            </ul>
          ),
        },
        {
          id: "youtube",
          title: "YouTube videos",
          body: (
            <p>
              Our live classes and some lectures are delivered through YouTube and shown in the Platform with the embedded YouTube player.
              By watching them you also agree to the{" "}
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>, and Google&apos;s
              handling of data in the player is described in the{" "}
              <a href="http://www.google.com/policies/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>. Class
              videos are unlisted and meant only for enrolled students — do not share their links.
            </p>
          ),
        },
        {
          id: "fees",
          title: "Fees and payments",
          body: (
            <ul>
              <li>Fees for batches and subscriptions are shown before you pay. Payments are processed securely by our payment partner.</li>
              <li>Access is given for the batch or period you paid for.</li>
              <li>Refunds, if any, are given as per the refund terms shown for that batch or as agreed in writing with us.</li>
            </ul>
          ),
        },
        {
          id: "content",
          title: "Our content",
          body: (
            <p>
              All classes, recordings, notes, modules, questions, tests, solutions and PDFs on the Platform belong to {LEGAL.company} or
              its teachers. They are for your personal study only. You must not record, copy, download (except where a download button is
              given), share, sell or upload them anywhere else.
            </p>
          ),
        },
        {
          id: "conduct",
          title: "Acceptable use",
          body: (
            <ul>
              <li>Be respectful to teachers and other students in live chat, doubts and messages.</li>
              <li>Do not cheat in tests, use other people&apos;s accounts, or try to break, overload or misuse the Platform.</li>
              <li>Do not post anything unlawful, abusive, obscene or misleading.</li>
            </ul>
          ),
        },
        {
          id: "suspension",
          title: "Suspension and termination",
          body: (
            <p>
              We may suspend or close an account that breaks these Terms, shares paid content or misuses the Platform. You may stop using
              the Platform at any time and ask us to delete your account.
            </p>
          ),
        },
        {
          id: "disclaimer",
          title: "Results and liability",
          body: (
            <p>
              We work hard to help you prepare, but we do not guarantee any exam result or rank. Rank predictions and AI-generated answers
              are estimates and may contain mistakes. The Platform is provided &quot;as is&quot;; to the extent the law allows, our total
              liability is limited to the fees you paid us for the service concerned.
            </p>
          ),
        },
        {
          id: "law",
          title: "Governing law",
          body: <p>These Terms are governed by the laws of India. Courts at Rampur, Uttar Pradesh shall have jurisdiction.</p>,
        },
        {
          id: "changes",
          title: "Changes to these Terms",
          body: <p>We may update these Terms. The new version will be posted on this page with its &quot;Last updated&quot; date; continuing to use the Platform means you accept it.</p>,
        },
        {
          id: "contact",
          title: "Contact and grievance officer",
          body: (
            <>
              <p>For any question or complaint about the Platform, contact our Grievance Officer:</p>
              <GrievanceOfficer />
            </>
          ),
        },
      ]}
    />
  );
}
