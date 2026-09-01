import Link from "next/link";
import { ScrollReveal } from "./ScrollReveal";

const REAL_FACULTY = [
  {
    name: "Firoz Ali (Firoz Sir)",
    slug: "firoz-ali",
    subject: "Founder & Chemistry Lead",
    experience: "5+ Years Exp (Ex-Unacademy / Doubtnut)",
    qualification: "M.Sc. Chemistry",
    avatarBg: "bg-amber-500/20 text-amber-600",
  },
  {
    name: "Sanu Yadav Sir",
    slug: "sanu-yadav",
    subject: "Physics Faculty",
    experience: "6+ Years Experience",
    qualification: "B.Tech Mechanical (NIT)",
    avatarBg: "bg-blue-500/20 text-blue-600",
  },
  {
    name: "Yaman Khan Sir",
    slug: "yaman-khan",
    subject: "Biology & Zoology Expert",
    experience: "5+ Years Experience",
    qualification: "M.Sc. Embryology",
    avatarBg: "bg-emerald-500/20 text-emerald-600",
  },
  {
    name: "Mukul Kashyap Sir",
    slug: "mukul-kashyap",
    subject: "Physics Faculty",
    experience: "7+ Years Experience",
    qualification: "M.Sc. Physics (IIT Roorkee)",
    avatarBg: "bg-purple-500/20 text-purple-600",
  },
  {
    name: "Mohsin Ali Sir",
    slug: "mohsin-ali",
    subject: "Chemistry Educator",
    experience: "4+ Years Experience",
    qualification: "B.Tech Chemical",
    avatarBg: "bg-rose-500/20 text-rose-600",
  },
  {
    name: "Rehan Ali Sir",
    slug: "rehan-ali",
    subject: "Biology Doubt Expert",
    experience: "4+ Years Experience",
    qualification: "BAMS (Ayurvedic Medicine)",
    avatarBg: "bg-teal-500/20 text-teal-600",
  },
] as const;

export function FacultySection() {
  return (
    <section id="faculty" className="py-stack-lg px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto space-y-12">
      <ScrollReveal className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          Expert Educator Faculty
        </div>
        <h2 className="font-display-lg text-display-lg text-on-surface">
          Learn from <span className="text-primary">Top Academic Mentors</span>
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
          Our educators are veteran mentors with proven track records in producing top NEET and JEE ranks through concept-first learning.
        </p>
      </ScrollReveal>

      <ScrollReveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {REAL_FACULTY.map((teacher) => (
          <Link
            key={teacher.slug}
            href={`/teachers/${teacher.slug}`}
            className="glass-card rounded-3xl p-6 border border-outline-variant/30 hover:border-primary/50 transition-all hover:-translate-y-1 hover:shadow-xl group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl shadow-md ${teacher.avatarBg}`}
                >
                  {teacher.name
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1 border border-primary/20">
                  <span className="material-symbols-outlined text-xs">verified</span>
                  Verified
                </span>
              </div>

              <div>
                <h4 className="font-bold text-base md:text-lg text-on-surface group-hover:text-primary transition-colors">
                  {teacher.name}
                </h4>
                <p className="text-xs font-semibold text-primary mt-0.5">{teacher.subject}</p>
                <p className="text-[11px] text-on-surface-variant mt-1 font-mono">{teacher.qualification}</p>
                <p className="text-xs text-on-surface-variant mt-2">{teacher.experience}</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs font-semibold text-primary">
              <span>View Full Profile</span>
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            </div>
          </Link>
        ))}
      </ScrollReveal>
    </section>
  );
}
