import { ScrollReveal } from "./ScrollReveal";

const BATCHES = [
  {
    title: "NEET 2027 (Phoenix)",
    badge: "Popular",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAMN8o8czbruHfQTHS1JBb6lhovVVv1m6_JsPFec0PDilKsfjxNMVrBx8gK7pvwMt0l698dVsJJzSgXLHmGTO696ojDIkchl70hFXwF4tbdmHIjWVsQSmhm1ct-dMwSQdGW5zs2HBwRPhdC1K8pJksVSUv6X0vThSWAbAJ1q2IIqJycSdjTQa4TLYaf2bRBXdptqlYdR9Mq22q9KP20zIUlT51oKvywjT-REbHzv0-fnNT0uwWrRBDGNa6ZaWsJaqxRm6oWXFqvu-o",
    description:
      "Comprehensive 2-year program for medical aspirants focusing on concept clarity and speed.",
    startDate: "Starts Aug 15, 2024",
    originalPrice: "₹49,999",
    price: "₹24,999",
  },
  {
    title: "JEE 2028 (Apex)",
    badge: null,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAJEqyUP_p0TGwbY-dv0GBf_2Mavyyyixidv5UmeTPhNeyUQtuvuh5-L2J_mKHfO4Gc9ERWxzYbTPEPFktZmwobEqqDtFaT_73Asro_EzbGt4YuDYXHLoHnZakLcLr-K83TDOk2JXRASHIdWJuGt1aJWOVSYb4qsEYZhma3ZWbaHE9A9_G1Kk0UTRnuYO5WZ5x13aq6WfKSq1NwL-tU9uf1PTTtm4YbH2E45pQXrHCKtpZuRd2Ik5Cuh-WpD0w5kP9cN7jTalHD-sk",
    description:
      "Intensive coaching for JEE Mains & Advanced with heavy emphasis on problem-solving techniques.",
    startDate: "Starts Sept 01, 2024",
    originalPrice: "₹54,999",
    price: "₹29,999",
  },
  {
    title: "Foundation Droppers",
    badge: null,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDdAtS0gcKrFY-44MFBAQnWP4DdUVnQcSL-cG8b9EGdjUHgKkPhmY24ulNOcBhUcsZY5ERQFg4OI6GoVsQF5B1yHMLRRp2sCz27SwtDVSrZnRkq54d3IShDwQ4oTTt9B5bSbpjmY575DIqOod6OEr6Jv4UZP2IJEvnHRFs_6Ud9kGWikWlGNn6xc2gbZebVk8eipztnmQZ5ALzF0wbcFeZC--mjWXxHQHCEYBDq24ZkTVdR6Gj4DCarH2OHlrYA1HYKJ6e8xGoOOTU",
    description:
      "A bridge program for students taking a gap year to strengthen their basics and hit higher ranks.",
    startDate: "Starts Aug 28, 2024",
    originalPrice: "₹39,999",
    price: "₹19,999",
  },
] as const;

export function BatchesSection() {
  return (
    <section id="batches" className="py-stack-lg px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
      <ScrollReveal>
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="font-display-lg text-display-lg mb-2">
              Upcoming <span className="text-primary">Batches</span>
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Structured curriculum designed by industry veterans.
            </p>
          </div>
          <button className="hidden md:flex items-center gap-2 text-primary font-label-md text-label-md group">
            View All Batches{" "}
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </button>
        </div>
      </ScrollReveal>

      <ScrollReveal className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {BATCHES.map((batch) => (
          <div key={batch.title} className="glass-card rounded-2xl overflow-hidden group">
            <div className="h-48 relative overflow-hidden">
              <img
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                alt={batch.title}
                src={batch.image}
              />
              <div className="absolute top-4 left-4 bg-secondary-container text-on-secondary-container font-label-md text-label-md px-3 py-1 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Live Classes
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-headline-md text-headline-md">{batch.title}</h3>
                {batch.badge && (
                  <span className="text-primary-fixed-dim bg-primary font-label-sm text-label-sm px-2 py-0.5 rounded">
                    {batch.badge}
                  </span>
                )}
              </div>
              <p className="text-label-sm font-label-sm text-on-surface-variant">
                {batch.description}
              </p>
              <div className="flex items-center gap-2 text-label-sm font-label-sm">
                <span className="material-symbols-outlined text-primary text-lg">event_note</span>
                {batch.startDate}
              </div>
              <div className="flex items-end justify-between pt-4 border-t border-outline-variant/20">
                <div>
                  <span className="text-on-surface-variant line-through text-label-sm font-label-sm">
                    {batch.originalPrice}
                  </span>
                  <div className="text-headline-md font-headline-md text-primary">
                    {batch.price}
                  </div>
                </div>
                <button className="bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-lg hover:bg-surface-tint transition-colors">
                  Join Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
