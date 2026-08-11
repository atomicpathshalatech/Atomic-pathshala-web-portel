import type { Metadata } from "next";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ApplicationForm } from "@/components/careers/ApplicationForm";

export const metadata: Metadata = {
  title: "Teach with Us",
  description: "Apply to join Atomic Pathshala as faculty.",
};

export default function CareersApplyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 min-h-[80vh] bg-surface-container-low/30 px-margin-mobile md:px-margin-desktop py-stack-lg">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
            Teach with <span className="text-primary">Atomic Pathshala</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-2">
            Join a team of expert educators shaping the next generation of doctors and engineers.
          </p>
        </div>
        <ApplicationForm />
      </main>
      <Footer />
    </>
  );
}
