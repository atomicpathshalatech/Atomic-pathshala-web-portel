import { ScrollReveal } from "./ScrollReveal";

const FEATURES = [
  {
    icon: "live_tv",
    title: "Live Classes",
    description: "Interactive real-time sessions with experts",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: "video_library",
    title: "Recorded Library",
    description: "Access any class, anywhere, anytime",
    iconBg: "bg-secondary-container/10",
    iconColor: "text-secondary",
  },
  {
    icon: "quiz",
    title: "Test Series",
    description: "Weekly mock tests with deep analytics",
    iconBg: "bg-tertiary-container/10",
    iconColor: "text-tertiary",
  },
  {
    icon: "assignment",
    title: "Daily DPPs",
    description: "Curated problem sets for daily practice",
    iconBg: "bg-error-container/10",
    iconColor: "text-error",
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="py-stack-lg bg-surface-container-low/30 px-margin-mobile md:px-margin-desktop">
      <ScrollReveal className="max-w-container-max mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="glass-card p-8 rounded-2xl text-center space-y-4 hover:scale-105 hover:shadow-[0_0_30px_rgba(0,80,203,0.15)] transition-all duration-500"
            >
              <div
                className={`w-16 h-16 ${feature.iconBg} rounded-full flex items-center justify-center mx-auto ${feature.iconColor}`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                  {feature.icon}
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md">{feature.title}</h3>
              <p className="text-label-sm font-label-sm text-on-surface-variant">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
