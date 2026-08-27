import { motion, useMotionValue, useTransform } from "framer-motion";
import { useMemo, useState, type ReactNode } from "react";

const SPRING = { type: "spring", stiffness: 300, damping: 25 } as const;

/**
 * Mystery Reveal: a shimmering particle overlay that fades out as the user
 * drags across the bubble, revealing the content underneath.
 */
export function InvisibleInk({ children }: { children: ReactNode }) {
  const drag = useMotionValue(0);
  const [revealed, setRevealed] = useState(false);
  const overlayOpacity = useTransform(drag, [0, 110], [1, 0]);

  const specks = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        d: 1.2 + Math.random() * 2.2,
        delay: Math.random() * 2,
      })),
    [],
  );

  return (
    <div className="relative">
      <motion.div
        animate={{ opacity: revealed ? 1 : 0.35, filter: revealed ? "blur(0px)" : "blur(6px)" }}
        transition={SPRING}
      >
        {children}
      </motion.div>

      {!revealed && (
        <motion.div
          className="absolute inset-0 cursor-grab touch-none overflow-hidden rounded-[inherit] active:cursor-grabbing"
          style={{ opacity: overlayOpacity }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDrag={(_, info) => drag.set(Math.abs(info.offset.x))}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 70) setRevealed(true);
            else drag.set(0);
          }}
          onDoubleClick={() => setRevealed(true)}
        >
          <div className="absolute inset-0 rounded-[inherit] bg-surface/95 backdrop-blur-md" />
          {specks.map((s) => (
            <motion.span
              key={s.id}
              className="absolute rounded-full bg-primary"
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.d, height: s.d }}
              animate={{ opacity: [0.15, 0.95, 0.15], scale: [0.8, 1.5, 0.8] }}
              transition={{ duration: 2.4, delay: s.delay, repeat: Infinity }}
            />
          ))}
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium tracking-wide text-muted-foreground">
            drag to reveal
          </span>
        </motion.div>
      )}
    </div>
  );
}
