import { ScrollReveal } from "./ScrollReveal";

const FACULTY = [
  {
    name: "Dr. Aryan Sharma",
    subject: "Physics Expert",
    experience: "18+ Years Experience",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAHN-SoCQNLRaaimiWMjUruD5lMsduSBL1-RKTkXnMv2vJdzpt44q5gLyN34be3QaQFU-H7GEem3_1IBqjhJ18eeohV9B5wxPjSkGcZ9TJN7QAOHrecTbA_zJjY_AS4gKemz7x3H1Gw32zukEovCzFCjFLNf5dZ9dMIEwJtlziOWPx_ug4y2XZ0c1RqKNKTS1jVpk4Danq2UMOY7XuK2S0U-ehsv9z6Sl4P_cSpGN0RsT7nMPQ5iUNg8gkLQR8LJwTr3PqdOMg3zoE",
  },
  {
    name: "Meera Singhania",
    subject: "Chemistry Maven",
    experience: "12+ Years Experience",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBJ6M0Z0wp1_Z2HrN0DBPynwrB9IuP7bbnzBWEF8vBn2rn0gbdg8uVSw0yjRP6wDTzXXEQAqN1zoRZ0T99I89tclDhzAUxqb8NuPolbzsoVSJTQObNZ-6L1iaGJ1WCLvX2CN8jQ9NlOGqAAARcbwYvoSsE6A4k4C_WrDRZAdVctFXNUpWIaM8CZSJiNPpS7ZBzyrrg71zI7uOb9SPtlu9FMNTFIWoofgIhbreVttZZ1sji8S4rGpd1olfSvNzdVw5h-s34tmudjcak",
  },
  {
    name: "Rajesh Khanna",
    subject: "Math Wizard",
    experience: "15+ Years Experience",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBHcA-fm4t8Pg4ekmaMb0BJEIsVlyiGzQ1dkF4DtERj0blYJQLu3Z_EvoWaDWgV8Rn14bmYalLJEoSXmFBYDnRfnbkmHytb_wnRhwkto8_aBYx_tdd9eYgEdnXaT5tekY9pAcSuHAbiTd1pNufiF8WiPHJJ2WmoF8V5TnLxmxpqb-6axRJdQGsf5vY4hPniY2iJOTaxvktiqAQQonN6dflktkXUVJ_8qtZc_YczAHlLAXzqKRyTOObL-Rl7XROUNLJMD4gA_moWt3Q",
  },
  {
    name: "Dr. Sneha Patil",
    subject: "Biology Guru",
    experience: "20+ Years Experience",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB2I5S-OxHulh389ioAFyxX3ZC0ECModuP9GyUSqVYA_opcCybwUdBfpajTEVN5l94FuZjVKWAZz3FoLwCNmGMt5rNgwUt1SP9ARIBEG1pDLLE7dEvtIFz8sFirRaSVhU_r5cQ5SyxFR9cNFEiz6kY6THRBEMdiwgBAqEr0Yz2-_0t4nK_9x3lINUc9t4lyTOjYxOKe6wMRFW2TZyJP8q2WeE_wDP9NOJCGeAjT8SxNj2JOxLQD1TskLyHgHjyLI0Jx7FaDeSEf084",
  },
] as const;

export function FacultySection() {
  return (
    <section id="faculty" className="py-stack-lg px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
      <ScrollReveal className="text-center mb-16">
        <h2 className="font-display-lg text-display-lg">
          Learn from the <span className="text-primary">Best</span>
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">
          Our educators are veteran mentors with 15+ years of experience in
          producing top AIR ranks.
        </p>
      </ScrollReveal>

      <ScrollReveal className="grid grid-cols-2 md:grid-cols-4 gap-gutter">
        {FACULTY.map((teacher) => (
          <div key={teacher.name} className="text-center group">
            <div className="w-48 h-48 mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary-container rounded-full opacity-10 group-hover:opacity-20 transition-opacity" />
              <img
                className="w-40 h-40 object-cover rounded-full mx-auto relative z-10 mt-4 border-4 border-white shadow-lg"
                alt={teacher.name}
                src={teacher.image}
              />
            </div>
            <h4 className="font-headline-md text-headline-md">{teacher.name}</h4>
            <p className="text-primary font-label-md text-label-md">{teacher.subject}</p>
            <p className="text-label-sm font-label-sm text-on-surface-variant">
              {teacher.experience}
            </p>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
