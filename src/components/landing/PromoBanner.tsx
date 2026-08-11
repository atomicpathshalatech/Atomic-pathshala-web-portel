export function PromoBanner() {
  return (
    <section className="relative w-full py-stack-lg px-margin-mobile md:px-margin-desktop overflow-hidden">
      <div className="max-w-container-max mx-auto relative min-h-[400px] flex items-center justify-center rounded-xl overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            alt="Advanced Test Series Background"
            className="w-full h-full object-cover"
            src="https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg"
          />
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10 glass-card p-8 md:p-12 rounded-xl max-w-3xl text-center space-y-6 border-white/20">
          <h2 className="font-display-lg text-display-lg text-primary leading-tight">
            Unlock Your Potential with Our{" "}
            <span className="text-gradient">Advanced JEE/NEET Test Series</span>
          </h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant">
            Get 50% off on all Pro plans this week. Use code{" "}
            <span className="font-bold text-primary">ATOMIC50</span>
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button className="bg-primary text-on-primary font-label-md text-label-md px-8 py-4 rounded-xl hover:opacity-90 transition-all shadow-lg w-full sm:w-auto">
              Get Started
            </button>
            <button className="border-2 border-primary text-primary font-label-md text-label-md px-8 py-4 rounded-xl hover:bg-primary/5 transition-all w-full sm:w-auto">
              View Plans
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
