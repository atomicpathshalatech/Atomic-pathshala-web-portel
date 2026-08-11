import { ScrollReveal } from "./ScrollReveal";

const TESTIMONIALS = [
  {
    name: "Ananya Verma",
    cohort: "Class of 2024",
    rank: "AIR 12 (NEET)",
    quote:
      "The AI doubt solving was a lifesaver during my late-night study sessions. Atomic Pathshala truly changed how I approach Physics.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCP5wJORw6Xxp0j9SDDBqbV88gXDlHN0F4ROpWCJobXQPyT28ABDpIF1_j8h7ZGdJYMy3SmTFa6DvSedoqSOzlScSxgXsi-MgbY7PIAXGzOtEezlTXAD1ysjRoYUMmNplCUflyy05UdLTIiUwt6Pdfo4m1uWSHXPZGBNupbeR6yNVOci7i089ylykVlcMJy-tNEi6al9led5x5ja_tD0kT0bc8tuZvGX_sDgtEHQv3W8EO6S-JDrxyFN498b4c53V3ri1v_tVNqh_g",
  },
  {
    name: "Rohit Mehra",
    cohort: "Class of 2024",
    rank: "AIR 45 (JEE)",
    quote:
      "Personal mentorship helped me stay sane during the toughest months. My mentor knew exactly when I needed a push or a break.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCoe1Sna0wx-B58sHAC01T2tZOWfkS2a22d0eU03213dvDvCUE5b4au1L474Sd5vMi-jDTpp3zBaVRcAxlhT3DFeisUWqXet3TPStbnM_mYvVDMhaXwlH4D_J9ENhzTv66FvZzuaeojH2aJJvPGCfzVayI6n4RzMjaQgm8W7pbtvST_pXnHiQ0p2wvXiLg-i6oG-akfokxfQfFJIHcepuvOPtorke_1k7Ho7AYvr_WTek6gsmQQRALsCZYJxlei8HZGewmk1Jxi_jE",
  },
  {
    name: "Ishita Jain",
    cohort: "Class of 2024",
    rank: "AIR 102 (NEET)",
    quote:
      "The test series analytics were spot on. I knew my weak chapters and worked specifically on them to improve my score from 580 to 705.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCnUF0zGyVYvuumBXCbL8ueDDGnlp_Ka8hTw5eoWNHfV06moaoRhZrmmhRZkRSWs-1ZE8J30HW6_3ABwe2ah1N7WL7IRwztoo7FMzG0RzcI97mlnKgkaCNbhpAhycmFkFNjzm3DgweZVaMwXpVCER-S2y3ee03Byvk4juFRmqKf_kofTpgPMkQAquiSuThxbvV7ZKwiomXT_yLtdLsv1Y7fPKa2rdyo7C2IZLxRx9sRuhCSPKcrIbjJzGm-y8jkILmlzNFddrU4ep0",
  },
  {
    name: "Vikram Roy",
    cohort: "Class of 2024",
    rank: "AIR 210 (JEE)",
    quote:
      "Live sessions are so interactive that it feels like the teacher is right in front of you. Highly recommend the Phoenix batch.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDS4H4Zg3wgNbRSerBL9uqe-yVTvwsOJMW387mzf2DizruXRqQSdiyrn6RHuLyS43nuXP7NnGWKwYUlEr84rCGxef4yo459nnBT6U2fYmMY4MoVoOFeGYkdAq8UNBvM-2T59IqIL7-ng3J4XeWE4Pl67EWHeVFZPXVSaD9I_ZkSpLV5BL3muNBwKUT-34LWflusg0odCLPEgh-0732Vd6xmUHhBjhGB0SD9Y92UrYUR6ix1P8lO5W6WvGCISbUr9OUiwSdS5xa9v30",
  },
] as const;

export function TestimonialsSection() {
  return (
    <section id="results" className="py-stack-lg px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
      <ScrollReveal className="text-center mb-16">
        <h2 className="font-display-lg text-display-lg">
          Real Results from <span className="text-primary">Real Students</span>
        </h2>
      </ScrollReveal>

      <ScrollReveal className="grid grid-cols-1 md:grid-cols-4 gap-stack-lg">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="glass-card p-6 rounded-2xl relative">
            <span className="absolute top-4 right-4 text-primary opacity-5 material-symbols-outlined text-6xl">
              format_quote
            </span>
            <div className="bg-tertiary text-on-tertiary-container font-label-sm text-label-sm px-3 py-1 rounded-full absolute -top-3 left-6 shadow-sm">
              {t.rank}
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary">
                <img className="w-full h-full object-cover" alt={t.name} src={t.image} />
              </div>
              <div>
                <h4 className="font-label-md text-label-md">{t.name}</h4>
                <p className="text-[10px] text-on-surface-variant">{t.cohort}</p>
              </div>
            </div>
            <p className="text-label-sm font-label-sm text-on-surface-variant italic">
              &quot;{t.quote}&quot;
            </p>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
