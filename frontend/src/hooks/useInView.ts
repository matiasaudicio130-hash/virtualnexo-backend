import { useEffect, useRef } from "react";

interface Options {
  enabled?: boolean;
  rootMargin?: string;
}

/** Dispara `onInView` cuando el elemento referenciado entra en el viewport (scroll infinito). */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  onInView: () => void,
  { enabled = true, rootMargin = "400px" }: Options = {}
) {
  const ref = useRef<T>(null);
  const cb = useRef(onInView);
  cb.current = onInView;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) cb.current();
      },
      { rootMargin, threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}
