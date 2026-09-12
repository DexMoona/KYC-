import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SurchiLogo from './SurchiLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  // Check if this is the first visit in this session to avoid slow animation on hot-reloads or frequent re-visits
  const isFirstVisit = !sessionStorage.getItem('surchi-splash-shown');
  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  useEffect(() => {
    // If reduced motion is preferred, make it much faster.
    // 4500ms display time to allow the slower 3-pulse animation (4.2s) to complete fully.
    const displayTime = prefersReducedMotion ? 100 : 4500;

    const timer = setTimeout(() => {
      setIsVisible(false);
      sessionStorage.setItem('surchi-splash-shown', 'true');
    }, displayTime);

    return () => clearTimeout(timer);
  }, []);

  // Handle actual unmount after fade out animation completes
  const handleExitComplete = () => {
    onComplete();
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isVisible && (
        <motion.div
          key="splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
        >
          <motion.div
            initial={{ opacity: prefersReducedMotion ? 1 : 0.2, scale: prefersReducedMotion ? 1 : 0.95, filter: prefersReducedMotion ? 'none' : 'brightness(0.4)' }}
            animate={{ opacity: 1, scale: 1, filter: prefersReducedMotion ? 'none' : 'brightness(1.2)' }}
            transition={{ 
              duration: prefersReducedMotion ? 0.1 : 0.6, 
              ease: 'easeInOut',
              repeat: prefersReducedMotion ? 0 : 6, // 6 repeats = 7 iterations (0.6s * 7 = 4.2s total). Result: 3 slower distinct dims.
              repeatType: 'mirror'
            }}
            className="flex flex-col items-center"
          >
            <div className="relative">
              {/* Subtle glow effect behind the logo */}
              {!prefersReducedMotion && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="absolute inset-0 rounded-full bg-elegant-gold/20 blur-xl"
                />
              )}
              <SurchiLogo size={100} className="relative z-10" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
