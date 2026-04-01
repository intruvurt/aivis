import { motion, useReducedMotion } from 'framer-motion';
import React, { type FC, type ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
  onClick?: () => void;
  href?: string;
  badge?: string;
  accentColor?: string; // tailwind gradient classes
  disableAnimations?: boolean;
}

const MotionAnchor = motion.a;
const MotionButton = motion.button;
const MotionDiv = motion.div;

export const FeatureCard: FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  delay = 0,
  onClick,
  href,
  badge,
  accentColor = 'from-white/25 to-white/14',
  disableAnimations = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !disableAnimations && !prefersReducedMotion;

  const isInteractive = Boolean(onClick || href);
  const isExternal = Boolean(href && /^https?:\/\//i.test(href));

  const baseClass =
    `relative block h-full glass-effect rounded-2xl p-8 transition-all duration-300 group ` +
    (isInteractive
      ? 'cursor-pointer hover:bg-charcoal-light focus:bg-charcoal-light focus:outline-none focus:ring-2 focus:ring-white/50'
      : '');

  const wrapperMotion = shouldAnimate
    ? {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        whileHover: isInteractive ? { y: -4, scale: 1.02 } : undefined,
        whileTap: isInteractive ? { scale: 0.98 } : undefined,
        transition: {
          duration: 0.6,
          delay,
          type: 'spring' as const,
          stiffness: 300,
          damping: 25,
        },
      }
    : { initial: false, animate: false };

  const Badge = badge ? (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, scale: 0.8 } : false}
      animate={shouldAnimate ? { opacity: 1, scale: 1 } : false}
      transition={{ delay: delay + 0.2 }}
      className="absolute top-4 right-4"
    >
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${accentColor} text-white shadow-lg`}
      >
        {badge}
      </span>
    </motion.div>
  ) : null;

  const Content = (
    <>
      {Badge}

      {/* Icon */}
      <div className="relative mb-6">
        <motion.div
          whileHover={shouldAnimate ? { scale: 1.1, rotate: 5 } : undefined}
          transition={{ type: 'spring' as const, stiffness: 400, damping: 17 }}
          className="relative inline-block"
        >
          <div
            className={`absolute inset-0 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300 bg-gradient-to-r ${accentColor} rounded-full`}
          />
          <div className="relative text-5xl transform transition-transform duration-300 group-hover:scale-110">
            {icon}
          </div>
        </motion.div>
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold mb-3 gradient-text group-hover:bg-clip-text group-hover:text-transparent transition-all duration-300">
        {title}
      </h3>

      {/* Description */}
      <p className="text-white/55 leading-relaxed group-hover:text-white/75 transition-colors duration-300">
        {description}
      </p>

      {/* Interactive indicator (FIXED) */}
      {isInteractive && (
        <motion.div
          initial={shouldAnimate ? { opacity: 0, x: -6 } : false}
          whileHover={shouldAnimate ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.2 }}
          className="mt-4 flex items-center text-sm font-medium text-white/55 group-hover:text-white"
        >
          <span>Learn more</span>
          <svg
            className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.div>
      )}

      {/* Hover border */}
      <div
        className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${accentColor} p-[1px] -z-10`}
      >
        <div className="h-full w-full rounded-2xl bg-[#323a4c]/95" />
      </div>
    </>
  );

  // Animate the clickable element itself (cleaner semantics)
  if (href) {
    return (
      <MotionAnchor
        {...wrapperMotion}
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="relative h-full"
        aria-label={`Learn more about ${title}`}
      >
        <div className={baseClass}>{Content}</div>
      </MotionAnchor>
    );
  }

  if (onClick) {
    return (
      <MotionButton
        {...wrapperMotion}
        type="button"
        onClick={onClick}
        className="relative h-full text-left"
        aria-label={`Learn more about ${title}`}
      >
        <div className={baseClass}>{Content}</div>
      </MotionButton>
    );
  }

  return (
    <MotionDiv {...wrapperMotion} className="relative h-full">
      <div className={baseClass}>{Content}</div>
    </MotionDiv>
  );
};

// Presets
export const CompactFeatureCard: FC<Omit<FeatureCardProps, 'description'> & { description?: string }> = (props) => (
  <FeatureCard {...props} description={props.description || ''} />
);

export const FeatureGrid: FC<{ children: ReactNode; columns?: 1 | 2 | 3 | 4; gap?: 4 | 6 | 8 }> = ({
  children,
  columns = 3,
  gap = 8,
}) => {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  } as const;

  const gridGap = {
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8',
  } as const;

  return <div className={`grid ${gridCols[columns]} ${gridGap[gap]}`}>{children}</div>;
};
