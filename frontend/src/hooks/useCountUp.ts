import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Anima un contador 0 → target cuando entra en viewport (una sola vez).
 * Respeta prefers-reduced-motion. Devuelve el ref para el <span>.
 * Mismo patrón que el CountUp de Landing.tsx.
 */
export function useCountUp(
  target: number,
  format: (n: number) => string = (n) => String(Math.round(n)),
) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || target <= 0) {
      el.textContent = format(target);
      return;
    }

    el.textContent = format(0);
    const obj = { v: 0 };
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top 95%",
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          v: target,
          duration: 1.2,
          ease: "power2.out",
          onUpdate: () => { if (ref.current) ref.current.textContent = format(obj.v); },
          onComplete: () => { if (ref.current) ref.current.textContent = format(target); },
        });
      },
    });

    return () => { st.kill(); gsap.killTweensOf(obj); };
  }, [target, format]);

  return ref;
}
