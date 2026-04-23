import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, Routes } from 'react-router-dom';

/**
 * Wraps Routes with AnimatePresence for smooth page transitions.
 * Each route change fades in from blur and fades out.
 * 
 * Usage:
 * <AnimatedRoutes>
 *   <Route path="/about" element={<About />} />
 *   {/* more routes */}
 * </AnimatedRoutes>
 */
export default function AnimatedRoutes({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <Routes location={location}>
          {children}
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}
