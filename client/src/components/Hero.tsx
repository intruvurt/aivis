import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { type FC, type ReactNode } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface HeroProps {
  /** Main heading text */
  title?: ReactNode;
  /** Subtitle/description text */
  subtitle?: string;
  /** Primary CTA button text */
  primaryCta?: string;
  /** Secondary CTA button text */
  secondaryCta?: string;
  /** Primary CTA click handler */
  onPrimaryCta?: () => void;
  /** Secondary CTA click handler */
  onSecondaryCta?: () => void;
  /** Primary CTA href (link instead of button) */
  primaryHref?: string;
  /** Secondary CTA href */
  secondaryHref?: string;
  /** Show animated background orbs */
  showOrbs?: boolean;
  /** Custom background component */
  backgroundComponent?: ReactNode;
  /** Enable parallax scroll effect */
  enableParallax?: boolean;
}

export const Hero: FC<HeroProps> = ({
  title,
  subtitle = "Experience the future of AI-powered data visualization. Transform complex insights into beautiful, interactive experiences.",
  primaryCta = "Get Started",
  secondaryCta = "Learn More",
  onPrimaryCta,
  onSecondaryCta,
  primaryHref,
  secondaryHref,
  showOrbs = true,
  backgroundComponent,
  enableParallax = true,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;

  // Parallax scroll effect
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, 150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  // Default title if not provided
  const defaultTitle = (
    <>
      <span className="gradient-text">AI Visualization</span>
      <br />
      <span className="text-white">Reimagined</span>
    </>
  );

  // Determine component type for CTAs
  const PrimaryComponent = primaryHref ? 'a' : 'button';
  const SecondaryComponent = secondaryHref ? 'a' : 'button';

  return (
    <section 
      className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden"
      aria-labelledby="hero-title"
    >
      {/* Animated background gradient */}
      <div 
        className="absolute inset-0 bg-gradient-to-br from-white/25/20 via-white/14 to-white/14/20"
        aria-hidden="true"
      >
        {shouldAnimate && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-white/25/10 via-white/14 to-white/14/10"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
      </div>

      {/* Custom background or default orbs */}
      {backgroundComponent || (showOrbs && (
        <>
          {/* Floating orbs */}
          <motion.div
            className="absolute top-20 left-20 w-72 h-72 bg-charcoal rounded-full blur-3xl pointer-events-none"
            animate={shouldAnimate ? {
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
              x: [0, 50, 0],
              y: [0, 30, 0],
            } : {}}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute bottom-20 right-20 w-96 h-96 bg-charcoal rounded-full blur-3xl pointer-events-none"
            animate={shouldAnimate ? {
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.5, 0.3],
              x: [0, -50, 0],
              y: [0, -30, 0],
            } : {}}
            transition={{
              duration: 8,
              repeat: Infinity,
              delay: 1,
              ease: "easeInOut",
            }}
            aria-hidden="true"
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-charcoal/20 rounded-full blur-3xl pointer-events-none"
            animate={shouldAnimate ? {
              scale: [1, 1.3, 1],
              opacity: [0.2, 0.4, 0.2],
            } : {}}
            transition={{
              duration: 10,
              repeat: Infinity,
              delay: 2,
              ease: "easeInOut",
            }}
            aria-hidden="true"
          />
        </>
      ))}

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"
        aria-hidden="true"
      />

      {/* Content with parallax */}
      <motion.div
        className="relative z-10 text-center max-w-6xl"
        style={enableParallax && shouldAnimate ? { y, opacity } : {}}
      >
        {/* Badge/Label */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-charcoal-light border border-white/8 mb-8"
        >
          <Sparkles className="w-4 h-4 text-white/80" />
          <span className="text-sm font-medium text-white">Powered by AI</span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          id="hero-title"
          initial={shouldAnimate ? { opacity: 0, y: 30 } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight"
        >
          {title || defaultTitle}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={shouldAnimate ? { opacity: 0, y: 30 } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg sm:text-xl md:text-2xl text-white/75 mb-12 max-w-3xl mx-auto leading-relaxed"
        >
          {subtitle}
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 30 } : false}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center"
        >
          {/* Primary CTA */}
          <PrimaryComponent
            href={primaryHref}
            onClick={onPrimaryCta}
            className="group px-8 py-4 bg-gradient-to-r from-white/25 to-white/14 rounded-full text-lg font-semibold hover:scale-105 active:scale-95 transition-all duration-300 shadow-2xl shadow-white/20 hover:shadow-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-white/0 inline-flex items-center gap-2"
            aria-label={primaryCta}
            {...(primaryHref?.startsWith('http') ? {
              target: '_blank',
              rel: 'noopener noreferrer',
            } : {})}
          >
            <span>{primaryCta}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
          </PrimaryComponent>

          {/* Secondary CTA */}
          <SecondaryComponent
            href={secondaryHref}
            onClick={onSecondaryCta}
            className="px-8 py-4 glass-effect rounded-full text-lg font-semibold hover:bg-charcoal-light active:scale-95 transition-all duration-300 border border-white/8 hover:border-white/14 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-white/0"
            aria-label={secondaryCta}
            {...(secondaryHref?.startsWith('http') ? {
              target: '_blank',
              rel: 'noopener noreferrer',
            } : {})}
          >
            {secondaryCta}
          </SecondaryComponent>
        </motion.div>

        {/* Social proof / stats */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={shouldAnimate ? { opacity: 1 } : false}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex flex-wrap justify-center gap-8 text-sm text-white/55"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-charcoal animate-pulse" />
            <span>Built for teams and agencies</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-charcoal" />
          <div>⭐⭐⭐⭐⭐ Highly rated experience</div>
          <div className="hidden sm:block w-px h-4 bg-charcoal" />
          <div> Reliable infrastructure</div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={shouldAnimate ? { opacity: 1, y: [0, 10, 0] } : false}
        transition={{
          opacity: { duration: 0.8, delay: 0.8 },
          y: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-2 text-white/55">
          <span className="text-xs uppercase tracking-wider">Scroll</span>
          <div className="w-6 h-10 rounded-full border-2 border-white/12 flex items-start justify-center p-2">
            <motion.div
              className="w-1 h-2 bg-charcoal rounded-full"
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
};

// Preset variants
export const MinimalHero: FC<Omit<HeroProps, 'showOrbs'>> = (props) => (
  <Hero {...props} showOrbs={false} />
);

export const ParallaxHero: FC<HeroProps> = (props) => (
  <Hero {...props} enableParallax={true} />
);

export const StaticHero: FC<HeroProps> = (props) => (
  <Hero {...props} showOrbs={false} enableParallax={false} />
);