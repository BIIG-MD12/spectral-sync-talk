import { motion } from "framer-motion";
import { useEffect, useState } from "react";

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
};

/** Animated ambient particle background used on the auth screen. */
export function ParticleField({ count = 28 }: { count?: number }) {
  // Random positions must be generated client-side only to avoid SSR
  // hydration mismatches.
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 5,
        duration: 9 + Math.random() * 14,
        delay: Math.random() * 6,
        drift: (Math.random() - 0.5) * 90,
      })),
    );
  }, [count]);


  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="halo absolute inset-0" />
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-primary"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            filter: "blur(1px)",
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.7, 0],
            y: [0, -140],
            x: [0, p.drift],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
