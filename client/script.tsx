// HeroSection component with parallax header and animated feature cards
import React from "react";
import React, { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

export const HeroSection: React.FC = () => {
  const headerRef = useRef<HTMLDivElement | null>(null);
  const featureCardsRef = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);

  const [message, setMessage] = useState("");
  const [showMessage, setShowMessage] = useState(false);
  const [buttonText, setButtonText] = useState("Get Started");

  // Parallax effect for header (RAF throttled)
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        if (!headerRef.current) return;
        const scrolled = window.scrollY;
        const maxTranslate = 64;
        const translateY = Math.min(scrolled * 0.25, maxTranslate);
        headerRef.current.style.transform = `translate3d(0, ${translateY}px, 0)`;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleGetStarted = () => {
    setMessage("Welcome aboard. Your signal starts now.");
    setShowMessage(true);
    setButtonText("Let’s Go");

    featureCardsRef.current.forEach((card) => {
      if (!card) return;
      // Tailwind animation class (defined in CSS)
      card.classList.remove("animate-feature-pulse");
      // force reflow so animation retriggers
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      card.offsetHeight;
      card.classList.add("animate-feature-pulse");
      setTimeout(() => card.classList.remove("animate-feature-pulse"), 550);
    });

    window.setTimeout(() => setButtonText("Get Started"), 2500);

    // Smooth jump to Features section
    const el = document.getElementById("features");
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full">
      {/* HERO */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={headerRef}
          className="relative pt-8 md:pt-12 pb-10 md:pb-14 transition-transform duration-200 will-change-transform"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/60 backdrop-blur px-3 py-1 text-xs font-semibold text-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            built for ai answer engines, not just seo
          </div>

          <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
            Evidence-backed site analysis for AI answers
            <span className="text-indigo-600"> Platform</span>
          </h1>

          <p className="mt-5 max-w-2xl text-base md:text-lg text-slate-600 leading-relaxed">
            you don’t need louder pages.
            you need pages that machines can explain.
            audit your site, surface the gaps, export proof in a form ai systems can cite.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              type="button"
              onClick={handleGetStarted}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/25 transition-all"
            >
              {buttonText}
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("how-it-works");
                if (!el) return;
                const y = el.getBoundingClientRect().top + window.scrollY - 96;
                window.scrollTo({ top: y, behavior: "smooth" });
              }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white/60 backdrop-blur px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-white transition-colors"
            >
              how it works
            </button>
          </div>

          {/* Message */}
          <div
            className={`mt-5 text-sm font-medium ${
              showMessage ? "text-emerald-700" : "text-transparent select-none"
            }`}
            aria-live="polite"
          >
            {showMessage ? message : "placeholder"}
          </div>
        </div>
      </section>

      {/* FEATURES ANCHOR */}
      <section id="features" className="scroll-mt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "audit like a model",
                desc: "titles, headings, schema, content clarity, performance signals",
              },
              {
                title: "turn gaps into proof",
                desc: "concrete fixes and evidence outputs you can publish immediately",
              },
              {
                title: "export ai-readable packs",
                desc: "json-ld and brag-ready bundles that travel with your brand",
              },
            ].map((f, i) => (
              <div
                key={f.title}
                ref={(el) => {
                  featureCardsRef.current[i] = el;
                }}
                className="rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur p-5 shadow-sm transition-transform"
              >
                <div className="text-sm font-semibold text-slate-900">{f.title}</div>
                <div className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS ANCHOR */}
      <section id="how-it-works" className="scroll-mt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur p-6">
            <div className="text-sm font-semibold text-slate-900">how it works</div>
            <ol className="mt-3 space-y-2 text-sm text-slate-600 leading-relaxed list-decimal list-inside">
              <li>you submit a url or paste content</li>
              <li>we extract machine signals and score visibility</li>
              <li>you get fixes, quick wins, and evidence you can ship</li>
            </ol>
          </div>
        </div>
      </section>

      {/* PRICING ANCHOR */}
      <section id="pricing" className="scroll-mt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 backdrop-blur p-6">
            <div className="text-sm font-semibold text-slate-900">pricing</div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              wire this to your tiers. if you want, i’ll plug in the paid fast-lane auth,
              verified badge, referral boosts, and agency portals so pricing isn’t just a page,
              it’s a lever.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
