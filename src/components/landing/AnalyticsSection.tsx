import { ScrollReveal } from "./ScrollReveal";

export function AnalyticsSection() {
  return (
    <section className="py-stack-lg bg-surface-dark text-on-surface-variant px-margin-mobile md:px-margin-desktop overflow-hidden">
      <ScrollReveal className="max-w-container-max mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1 space-y-stack-md order-2 md:order-1">
          <h2 className="font-display-lg text-display-lg text-surface-container-lowest">
            Analyze. Adapt. <span className="text-secondary-container">Achieve.</span>
          </h2>
          <p className="font-body-lg text-body-lg text-surface-variant/80">
            Track your performance with microscopic detail. Our dashboard
            helps you identify weak spots and predicts your potential AIR
            with 95% accuracy.
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <img
              className="h-14 cursor-pointer hover:scale-105 transition-transform"
              alt="Download on the App Store"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuByPEYedwOXzkTemxgNbdZW1Ft9TCGcZA6jt5HojaH7Ow744FK6HPGHgqIbjVEgSS19ZdLTFVBJCKLSFlTmKUor4LFOaLuqNffh3G8pENM9hU4h8f9PbEJlgx9gGBA1pChOzcUG0AyM6Evs4AKB-bPMk_vrqOHyRHCl6a3toOlPkEt1VJosx4fKUxyVtltvNxUSNoYeUBHYmxSZ5H0DVuWEb6NfM7DNFSWipQsXq0VF9rIzfSWAgTQ1_5s3o3EjJyEHtZAjgJh3nMg"
            />
            <img
              className="h-14 cursor-pointer hover:scale-105 transition-transform"
              alt="Get it on Google Play"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCG0LjfBWYRc_HZOj3-FFH8RCXLLDPNFCFgW4Qv2f0OX0Oh5SEvbvBnfhJLfLYQ6y2mjkje9A5PUUQ-6k481OiTFF8wh0FT_YOkQVBOfxB6epAtLuZDJCVJAiFE17fPE2Oza0BVw1mZhSdc-iHv4xOQwB3cwjjw4WDSXpe4y8nu9BvwKPJ4zKm9BxhEZ3zKoV48s2UFrpvdCv5esHQ6LLC9FlvbyXD_ThMPsS4TgQoQt2bA1vnJpj6AWnVRISQOcTdQ2J1v3urKffo"
            />
          </div>
        </div>

        <div className="flex-1 relative order-1 md:order-2 w-full max-w-lg">
          <div className="absolute inset-0 bg-secondary-container/20 blur-[100px] rounded-full" />
          <img
            className="relative z-10 w-full drop-shadow-2xl rounded-3xl border border-white/10"
            alt="Performance analytics dashboard mockup"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBmOifRK15oJqj7dwAA2xtVdtnsQ8u24so55Eu-BsDFq1firfwk4xVwAumV9DD7zDV1rSCpusIvxorhBAxiNvqiFjx9l9KHajXuBw5cV-Yu5Tnfu0i94kOt_SP77e_hT_YCjle7YI2L6V2K2yzftO8lt1sOLenuJ6C2ap9CTi9F1YnGw37AkMojir0bJEqF_Dn7N88iKusAUpDIBPT1RK3RUptFlWGBtK2KIZTM0AXnNr2D7vM4_ZPMi0bccT1nKVI23KCzkvLCong"
          />
        </div>
      </ScrollReveal>
    </section>
  );
}
