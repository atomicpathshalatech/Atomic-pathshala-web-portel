import { ScrollReveal } from "./ScrollReveal";

const MENTORSHIP_POINTS = [
  "Personalized Study Plans",
  "Bi-weekly Progress Reviews",
  "Exam Strategy Sessions",
] as const;

export function AIBentoSection() {
  return (
    <section className="py-stack-lg bg-surface-container px-margin-mobile md:px-margin-desktop">
      <ScrollReveal className="max-w-container-max mx-auto space-y-stack-lg">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <h2 className="font-display-lg text-display-lg">
            The <span className="text-primary">Atomic</span> Edge
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Beyond classes, we provide tools and mentorship that make learning
            personal and effective.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
          <div className="md:col-span-7 glass-card rounded-[2rem] p-8 md:p-12 overflow-hidden relative flex flex-col justify-center">
            <div className="space-y-6 z-10">
              <div className="w-12 h-12 bg-primary-container/20 rounded-xl flex items-center justify-center text-primary mb-4">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <h3 className="font-display-lg text-display-lg">AI-Powered Doubt Solving</h3>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Scan any problem from your textbook and get instant video
                solutions and step-by-step explanations 24/7.
              </p>
              <div className="pt-6">
                <img
                  className="rounded-2xl shadow-2xl border-4 border-white/50 w-full max-w-md"
                  alt="AI doubt solving mobile UI mockup"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBFZDxLf64KXRo01gU73xx1e1Mibt52O9G4D3hUKeIe4PvN0MMvc4N7Oy0c5RrzeAgusBM3QjOSu3XowiGRLvci1_icalFoYeZxdcpkrxbdPAuycknilF45wYvRgkoE9qWep_nsih0oGpKXUseGO9DGCDMzDX3n-otMpU8skoKLwp3opt9xcq-6WmA7h8xUOCT2BWNpCfQo-q8DLMdo1gDq_DjdPeX618-1vqaCPeobrM7n3h0XsSYDCGxAFWxo1_PZwghfkUlAz4M"
                />
              </div>
            </div>
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
          </div>

          <div className="md:col-span-5 bg-primary text-on-primary rounded-[2rem] p-8 md:p-12 overflow-hidden relative flex flex-col justify-end">
            <div className="absolute top-8 right-8">
              <span className="material-symbols-outlined text-[100px] opacity-10">groups</span>
            </div>
            <div className="space-y-6 relative">
              <h3 className="font-headline-lg text-headline-lg">1-on-1 Personal Mentorship</h3>
              <p className="font-body-md text-body-md opacity-90">
                Every student gets assigned a dedicated academic mentor for
                planning, strategy, and emotional support throughout their
                journey.
              </p>
              <ul className="space-y-3">
                {MENTORSHIP_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary-container">
                      check_circle
                    </span>{" "}
                    {point}
                  </li>
                ))}
              </ul>
              <button className="bg-on-primary text-primary font-label-md text-label-md px-8 py-4 rounded-xl hover:bg-surface-container-low transition-all w-full mt-4">
                Book Free Session
              </button>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
