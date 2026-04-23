import { motion } from 'framer-motion';

export default function AppBootLoader() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-slate-950 overflow-hidden">
      {/* Scanning lines - vertical sweep */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent"
        animate={{ y: ['-100%', '100%'] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
      />

      {/* Pulse core - breathing center glow */}
      <motion.div
        className="h-20 w-20 rounded-full bg-cyan-500/20 blur-xl"
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
      />

      {/* Content layer */}
      <div className="relative z-10 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-xs uppercase tracking-widest text-cyan-300"
        >
          initializing audit engine
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-3 text-sm text-slate-400 font-light"
        >
          mapping entities · loading signals · preparing scan
        </motion.p>

        {/* Subtext fade-in */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-6 flex items-center justify-center gap-1"
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                delay: i * 0.2,
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
}
