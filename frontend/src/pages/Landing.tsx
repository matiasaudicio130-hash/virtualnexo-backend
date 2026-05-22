import { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* ── Copy bilingue ─────────────────────────────────────────── */
const COPY = {
  es: {
    toggle: "EN",
    nav: { login: "Ingresar", join: "Solicitar acceso" },
    hero: {
      tag: "Identidad verificada  ·  Fotos protegidas  ·  Solo Argentina",
      h1a: "Donde la identidad",
      h1b: "siempre es real.",
      sub: "La comunidad adulta verificada de Argentina. Cada perfil confirma su identidad con DNI y biometría. Tus fotos, protegidas por diseño.",
      cta: "Solicitar acceso",
      ctaSub: "Ya tengo cuenta",
    },
    proof: {
      items: [
        { n: "01", label: "Verificación real", body: "DNI y biometría. No hay forma de entrar fingiendo ser otro." },
        { n: "02", label: "Fotos protegidas", body: "Cada imagen lleva tu firma invisible. Si se filtra, sabemos quién fue." },
        { n: "03", label: "Vos decidís todo", body: "Quién te ve. Quién te escribe. Cuándo desaparecer del radar." },
      ],
    },
    how: {
      eyebrow: "Cómo funciona",
      h2: "Confianza por diseño,\nno por promesa.",
      steps: [
        { n: "01", title: "Tu identidad, confirmada", body: "Verificamos quién sos con DNI y reconocimiento facial. Sin excepciones. El primer paso para que todos sepan con quién están hablando." },
        { n: "02", title: "Tus fotos, firmadas", body: "Cada imagen que compartís lleva una marca de agua invisible incrustada en los píxeles. Nadie puede redistribuirla sin dejar rastro." },
        { n: "03", title: "Conexiones sin incógnitas", body: "Personas verificadas cerca tuyo. Sabés de entrada que del otro lado hay una persona real, con identidad confirmada." },
      ],
    },
    leak: {
      eyebrow: "Tecnología exclusiva",
      pull: "Cuando alguien intenta filtrar\nuna foto tuya, ya sabemos\nquién es.",
      body: "Cada imagen subida a AURA lleva una firma digital invisible incrustada en los píxeles mediante esteganografía LSB. No importa cuántas veces se comparta, recorte o edite: la identidad del responsable queda registrada.",
      tag: "Esteganografía LSB  ·  Watermark visible  ·  ID del usuario",
    },
    features: {
      eyebrow: "Por qué AURA",
      h2: "Privacidad no es una opción.\nEs el fundamento.",
      items: [
        { title: "Identidad verificada", body: "Cada miembro confirma su identidad con DNI y biometría. Sin excepciones. La comunidad más real de Argentina.", icon: "shield" },
        { title: "Firma invisible en fotos", body: "Esteganografía LSB: cada imagen lleva tu usuario ID incrustado. Redistribuirla tiene consecuencias rastreables.", icon: "lock" },
        { title: "Personas cerca tuyo", body: "Geolocalización con radio ajustable de 10 a 500km. Ves solo lo que es relevante para vos.", icon: "map" },
        { title: "Control total", body: "Quién te ve. Quién puede escribirte. Modo anónimo disponible para miembros. Todo bajo tu control.", icon: "sliders" },
      ],
    },
    travel: {
      eyebrow: "Modo viaje",
      h2: "¿Viajás a Córdoba este finde?",
      sub: "Antes de llegar, ya sabés quién está. Activá el Modo Viaje y descubrí la comunidad verificada en cualquier ciudad de Argentina.",
      cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "Mar del Plata", "Salta", "Bariloche"],
    },
    profiles: {
      eyebrow: "La comunidad",
      h2: "Diversa. Verificada. Selectiva.",
      sub: "Sin etiquetas obligatorias. Solo personas reales que saben lo que buscan.",
      items: [
        { dot: "bg-blue-400",    label: "Hombres",              desc: "Verificados, reales, cerca tuyo." },
        { dot: "bg-pink-400",    label: "Mujeres",              desc: "Con identidad confirmada y control total sobre su experiencia." },
        { dot: "bg-violet-400",  label: "Identidades diversas", desc: "Un espacio sin juicios ni etiquetas forzadas." },
        { dot: "bg-emerald-400", label: "Parejas",              desc: "Que saben exactamente lo que buscan juntos." },
        { dot: "bg-amber-400",   label: "Grupos",               desc: "Conexiones selectivas y consensuadas." },
      ],
    },
    testimonials: {
      eyebrow: "La comunidad habla",
      h2: "Lo que más cambia\nes la confianza.",
      items: [
        { q: "Por primera vez no me pregunto si el perfil es real. Eso solo ya vale la membresía.", by: "M., 34 — Buenos Aires" },
        { q: "Sabés que si subís algo acá, no va a aparecer en otro lado. Eso no existe en ninguna otra app.", by: "Pareja — San Isidro" },
        { q: "El nivel de personas es completamente diferente. Se nota que hay una barrera de entrada real.", by: "A., 29 — Rosario" },
        { q: "Tres ciudades, tres viajes. El Modo Viaje es el diferencial que nadie más tiene.", by: "Anónimo — Córdoba" },
      ],
    },
    pricing: {
      eyebrow: "Acceso",
      h2: "Una membresía.\nAcceso completo.",
      sub: "Sin niveles. Sin funciones ocultas. Verificación incluida. Todo desde el primer día.",
      cta: "Unirme a AURA",
      note: "Verificación requerida  ·  Solo mayores de 18 años  ·  Argentina",
    },
    footer: {
      tagline: "La comunidad adulta verificada de Argentina.",
      legal: "Solo para mayores de 18 años. El acceso requiere verificación de identidad.",
      links: ["Privacidad", "Términos", "Contacto"],
      copy: "AURA  ·  EXCLUSIVE LIFESTYLE",
    },
  },
  en: {
    toggle: "ES",
    nav: { login: "Sign in", join: "Request access" },
    hero: {
      tag: "Verified identity  ·  Protected photos  ·  Argentina only",
      h1a: "Where identity",
      h1b: "is always real.",
      sub: "Argentina's verified adult community. Every profile confirms their identity with government ID and biometrics. Your photos, protected by design.",
      cta: "Request access",
      ctaSub: "I have an account",
    },
    proof: {
      items: [
        { n: "01", label: "Real verification", body: "Government ID and biometrics. No way to enter pretending to be someone else." },
        { n: "02", label: "Protected photos", body: "Every image carries your invisible signature. If it leaks, we know who did it." },
        { n: "03", label: "You decide everything", body: "Who sees you. Who messages you. When to disappear from the radar." },
      ],
    },
    how: {
      eyebrow: "How it works",
      h2: "Trust by design,\nnot by promise.",
      steps: [
        { n: "01", title: "Your identity, confirmed", body: "We verify who you are with government ID and facial recognition. No exceptions. So everyone knows who they're talking to." },
        { n: "02", title: "Your photos, signed", body: "Every image you share carries an invisible watermark embedded in the pixels. No one can redistribute it without leaving a trace." },
        { n: "03", title: "Connections without unknowns", body: "Verified people near you. You know from the start that the person on the other side is real, with a confirmed identity." },
      ],
    },
    leak: {
      eyebrow: "Exclusive technology",
      pull: "When someone tries to leak\na photo of yours, we already\nknow who it is.",
      body: "Every image uploaded to AURA carries an invisible digital signature embedded in the pixels using LSB steganography. No matter how many times it's shared, cropped, or edited: the responsible party's identity is recorded.",
      tag: "LSB Steganography  ·  Visible Watermark  ·  User ID",
    },
    features: {
      eyebrow: "Why AURA",
      h2: "Privacy is not an option.\nIt is the foundation.",
      items: [
        { title: "Verified identity", body: "Every member confirms their identity with government ID and biometrics. No exceptions. The most real community in Argentina.", icon: "shield" },
        { title: "Invisible photo signature", body: "LSB steganography: every image carries your user ID embedded. Redistributing it has traceable consequences.", icon: "lock" },
        { title: "People near you", body: "Geolocation with adjustable radius from 10 to 500km. You see only what is relevant to you.", icon: "map" },
        { title: "Total control", body: "Who sees you. Who can message you. Anonymous mode for members. Everything under your control.", icon: "sliders" },
      ],
    },
    travel: {
      eyebrow: "Travel mode",
      h2: "Travelling to Córdoba this weekend?",
      sub: "Before you arrive, you already know who is there. Activate Travel Mode and discover the verified community in any city in Argentina.",
      cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "Mar del Plata", "Salta", "Bariloche"],
    },
    profiles: {
      eyebrow: "The community",
      h2: "Diverse. Verified. Selective.",
      sub: "No forced labels. Just real people who know what they want.",
      items: [
        { dot: "bg-blue-400",    label: "Men",               desc: "Verified, real, near you." },
        { dot: "bg-pink-400",    label: "Women",             desc: "With confirmed identity and full control over their experience." },
        { dot: "bg-violet-400",  label: "Diverse identities",desc: "A space without judgment or forced labels." },
        { dot: "bg-emerald-400", label: "Couples",           desc: "Who know exactly what they want together." },
        { dot: "bg-amber-400",   label: "Groups",            desc: "Selective and consensual connections." },
      ],
    },
    testimonials: {
      eyebrow: "The community speaks",
      h2: "What changes most\nis the trust.",
      items: [
        { q: "For the first time I don't wonder if the profile is real. That alone is worth the membership.", by: "M., 34 — Buenos Aires" },
        { q: "You know that if you post something here, it won't show up somewhere else. That doesn't exist in any other app.", by: "Couple — San Isidro" },
        { q: "The level of people is completely different. You can tell there's a real barrier to entry.", by: "A., 29 — Rosario" },
        { q: "Three cities, three trips. Travel Mode is the differentiator no one else has.", by: "Anonymous — Córdoba" },
      ],
    },
    pricing: {
      eyebrow: "Access",
      h2: "One membership.\nFull access.",
      sub: "No tiers. No hidden features. Verification included. Everything from day one.",
      cta: "Join AURA",
      note: "Verification required  ·  Adults 18+ only  ·  Argentina",
    },
    footer: {
      tagline: "Argentina's verified adult community.",
      legal: "For adults 18 and over only. Access requires identity verification.",
      links: ["Privacy", "Terms", "Contact"],
      copy: "AURA  ·  EXCLUSIVE LIFESTYLE",
    },
  },
} as const;

/* ── Inline SVG icons ─────────────────────────────────────── */
const PATHS: Record<string, string[]> = {
  shield:  ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  lock:    ["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z","M7 11V7a5 5 0 0110 0v4"],
  map:     ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z","M12 10a1 1 0 100-2 1 1 0 000 2z"],
  sliders: ["M4 6h16","M4 12h16","M4 18h16","M8 6V4","M8 10V8","M16 12v-2","M16 16v-2","M10 18v-2","M10 22v-2"],
  plane:   ["M22 2L11 13","M22 2L15 22l-4-9-9-4 20-7z"],
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {(PATHS[name] || []).map((d, i) => <path key={i} d={d}/>)}
    </svg>
  );
}

/* ── Magnetic button hook ─────────────────────────────────── */
function useMagnet(strength = 0.35) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - rect.left - rect.width  / 2) * strength;
      const dy = (e.clientY - rect.top  - rect.height / 2) * strength;
      gsap.to(el, { x: dx, y: dy, duration: 0.35, ease: "power2.out" });
    };
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1,0.4)" });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, [strength]);
  return ref;
}

/* ── Phone mockup ────────────────────────────────────────── */
function PhoneMockup() {
  const POST_COLORS = [
    "rgba(201,162,39,0.07)",
    "rgba(120,60,200,0.07)",
    "rgba(201,162,39,0.05)",
  ];
  return (
    <div className="relative mx-auto select-none" style={{ width: 220, height: 440 }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none"
        style={{ boxShadow: "0 0 80px rgba(201,162,39,0.10), 0 0 160px rgba(201,162,39,0.04)" }}/>
      {/* Frame */}
      <div className="absolute inset-0 rounded-[2.5rem] border border-amber-800/35 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0e0d18 0%, #08080f 100%)" }}>
        {/* Side button illusion */}
        <div className="absolute right-0 top-20 w-0.5 h-10 rounded-l-full bg-amber-900/30"/>
        <div className="absolute right-0 top-36 w-0.5 h-7  rounded-l-full bg-amber-900/20"/>
        {/* Screen */}
        <div className="absolute inset-x-2.5 top-10 bottom-6 rounded-[2rem] overflow-hidden"
          style={{ background: "#03030b" }}>
          {/* Notch */}
          <div className="absolute top-0 inset-x-0 h-5 flex items-center justify-center z-10"
            style={{ background: "#03030b" }}>
            <div className="w-14 h-3 rounded-full bg-black/90"/>
          </div>
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-6 pb-1">
            <div className="flex gap-1 items-center">
              <div className="w-4 h-1 rounded-full bg-amber-500/25"/>
              <span className="text-[6px] text-amber-500/30 font-light tracking-wider">AURA</span>
            </div>
            <div className="flex gap-1.5 items-center">
              <div className="w-5 h-1 rounded-full bg-amber-800/20"/>
              <div className="w-2.5 h-1 rounded-full bg-amber-600/35"/>
            </div>
          </div>
          {/* Stories row */}
          <div className="flex gap-2 px-3 pb-2 pt-1 border-b border-amber-900/15">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`rounded-full flex-shrink-0 ${i === 0 ? "border border-amber-500/60" : "border border-amber-900/25"}`}
                style={{ width: 28, height: 28, background: `rgba(201,162,39,${0.04 + i * 0.015})` }}/>
            ))}
          </div>
          {/* Feed posts */}
          {POST_COLORS.map((bg, i) => (
            <div key={i} className="px-3 py-2 border-b border-amber-900/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-5 h-5 rounded-full border border-amber-800/30 flex-shrink-0"
                  style={{ background: `rgba(201,162,39,${0.06 + i * 0.03})` }}/>
                <div className="w-12 h-1 rounded-full bg-amber-800/20"/>
                <div className="ml-auto w-1 h-1 rounded-full bg-amber-800/15"/>
                <div className="w-1 h-1 rounded-full bg-amber-800/15"/>
                <div className="w-1 h-1 rounded-full bg-amber-800/15"/>
              </div>
              <div className="w-full rounded-lg mb-1.5" style={{ height: 64, background: bg, border: "1px solid rgba(201,162,39,0.06)" }}/>
              <div className="flex gap-2 items-center">
                <div className="w-4 h-1 rounded-full bg-amber-800/20"/>
                <div className="w-4 h-1 rounded-full bg-amber-800/15"/>
                <div className="w-4 h-1 rounded-full bg-amber-800/12"/>
                <div className="ml-auto w-3 h-1 rounded-full bg-amber-800/15"/>
              </div>
            </div>
          ))}
          {/* Nav bar */}
          <div className="absolute bottom-0 inset-x-0 h-8 flex items-center justify-around px-4 border-t border-amber-900/15"
            style={{ background: "rgba(3,3,11,0.95)" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`rounded-full ${i === 1 ? "bg-amber-500/50" : "bg-amber-800/20"}`}
                style={{ width: i === 1 ? 14 : 10, height: i === 1 ? 14 : 10 }}/>
            ))}
          </div>
        </div>
        {/* Home indicator */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-amber-800/25"/>
      </div>
    </div>
  );
}

/* ── Golden particles ─────────────────────────────────────── */
function Particles() {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!wrap.current) return;
    const els = Array.from(wrap.current.children) as HTMLElement[];
    els.forEach(el => {
      gsap.set(el, { x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, opacity: 0 });
      const dur = 5 + Math.random() * 9;
      gsap.timeline({ repeat: -1, delay: Math.random() * dur })
        .to(el, { y: `-=${150 + Math.random() * 200}`, opacity: 0.5, duration: dur * 0.4, ease: "none" })
        .to(el, { opacity: 0, duration: dur * 0.6, ease: "none" });
      gsap.to(el, { x: `+=${(Math.random() - 0.5) * 80}`, duration: dur * 0.7, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
  }, []);
  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {Array.from({ length: 30 }).map((_, i) => {
        const s = 0.8 + Math.random() * 2.2;
        return <div key={i} style={{ width: s, height: s, borderRadius: "50%", background: "#FFE566", position: "absolute" }}/>;
      })}
    </div>
  );
}

/* ── AURA mark ────────────────────────────────────────────── */
function Mark({ size = 40 }: { size?: number }) {
  return (
    <img src="/brand/logo-full-dark.jpg" alt="AURA" draggable={false}
      style={{ width: size, height: size, objectFit: "contain", mixBlendMode: "screen" as const,
               filter: "drop-shadow(0 0 6px rgba(201,162,39,0.4))" }}/>
  );
}

function HeroMark() {
  return (
    <div className="hero-mark" style={{ position: "relative", width: 260, height: 260 }}>
      <img src="/brand/logo-full-dark.jpg" alt="AURA" draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "screen",
                 filter: "drop-shadow(0 0 22px rgba(201,162,39,0.5)) brightness(1.05)" }}/>
    </div>
  );
}

/* ── Section eyebrow ──────────────────────────────────────── */
function Eyebrow({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`text-[10px] tracking-[.45em] text-amber-500/60 uppercase mb-4 ${className}`}>
      {text}
    </p>
  );
}

/* ── Divider ──────────────────────────────────────────────── */
function Divider() {
  return <div className="s-line h-px bg-gradient-to-r from-transparent via-amber-900/30 to-transparent origin-left"/>;
}

/* ═══════════════════════════════════════════════════════════ */
export default function Landing() {
  const [lang, setLang] = useState<"es"|"en">("es");
  const c = COPY[lang];

  const howRef    = useRef<HTMLElement>(null);
  const leakRef   = useRef<HTMLElement>(null);
  const featRef   = useRef<HTMLElement>(null);
  const mockupRef = useRef<HTMLElement>(null);
  const travelRef = useRef<HTMLElement>(null);
  const profRef   = useRef<HTMLElement>(null);
  const testRef   = useRef<HTMLElement>(null);
  const priceRef  = useRef<HTMLElement>(null);

  const ctaPrimary   = useMagnet(0.38);
  const ctaSecondary = useMagnet(0.28);

  /* Animated hero bg gradient */
  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(".hero-bg", { backgroundPosition: "100% 100%", duration: 9, ease: "sine.inOut" })
      .to(".hero-bg", { backgroundPosition: "0% 50%",   duration: 9, ease: "sine.inOut" });
    return () => { tl.kill(); };
  }, []);

  const makeScrollTrigger = useCallback(
    (trigger: React.RefObject<HTMLElement | null>, start = "top 78%") =>
      ({ trigger: trigger.current, start, toggleActions: "play none none none" }),
    []
  );

  useGSAP(() => {
    const sd = { duration: 0.85, ease: "power3.out" };

    /* ── Hero entrance ─────────────────────────────────── */
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(".hero-mark",   { scale: 0.75, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6 })
      .fromTo(".hero-tag",    { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.7")
      .fromTo(".hero-line-1", { y: 55, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0 }, "-=0.55")
      .fromTo(".hero-line-2", { y: 55, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0 }, "-=0.75")
      .fromTo(".hero-sub",    { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
      .fromTo(".hero-ctas",   { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.45")
      .fromTo(".scroll-ind",  { opacity: 0 }, { opacity: 1, duration: 0.5 }, "-=0.1");

    gsap.to(".hero-mark", { y: -20, duration: 4, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".hero-mark", {
      y: -80, ease: "none",
      scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 2 },
    });

    /* ── Proof strip ────────────────────────────────────── */
    gsap.fromTo(".proof-item", { y: 32, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.15, ...sd,
      scrollTrigger: { trigger: ".proof-strip", start: "top 82%" } });

    /* ── HOW ─────────────────────────────────────────────── */
    gsap.fromTo(".how-head", { y: 28, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd,
      scrollTrigger: makeScrollTrigger(howRef) });
    gsap.fromTo(".how-step", { y: 55, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.18, ...sd,
      scrollTrigger: makeScrollTrigger(howRef, "top 72%") });

    /* ── LEAK section ────────────────────────────────────── */
    gsap.fromTo(".leak-ey",  { y: 20, opacity: 0 }, { y: 0, opacity: 1, ...sd,
      scrollTrigger: makeScrollTrigger(leakRef) });
    gsap.fromTo(".leak-pull",{ clipPath: "inset(0 100% 0 0)", opacity: 0 },
      { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 1.4, ease: "power3.out",
        scrollTrigger: makeScrollTrigger(leakRef, "top 74%") });
    gsap.fromTo(".leak-body,.leak-tag", { y: 24, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.12, ...sd,
        scrollTrigger: makeScrollTrigger(leakRef, "top 68%") });

    /* ── FEATURES ─────────────────────────────────────────── */
    gsap.fromTo(".feat-head", { y: 28, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd,
      scrollTrigger: makeScrollTrigger(featRef) });
    gsap.fromTo(".feat-card", { y: 45, opacity: 0, scale: 0.97 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.12, duration: 0.75, ease: "power3.out",
        scrollTrigger: makeScrollTrigger(featRef, "top 72%") });

    /* ── MOCKUP ──────────────────────────────────────────── */
    gsap.fromTo(".mockup-text", { x: -40, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.1, ...sd,
      scrollTrigger: makeScrollTrigger(mockupRef) });
    gsap.fromTo(".mockup-phone", { x: 40, opacity: 0, rotateY: 12 },
      { x: 0, opacity: 1, rotateY: 0, duration: 1.1, ease: "power3.out",
        scrollTrigger: makeScrollTrigger(mockupRef, "top 74%") });
    gsap.to(".mockup-phone", {
      y: -16, duration: 3.5, ease: "sine.inOut", repeat: -1, yoyo: true,
      scrollTrigger: { trigger: mockupRef.current, start: "top 80%" },
    });

    /* ── TRAVEL ──────────────────────────────────────────── */
    gsap.fromTo(".travel-head", { y: 28, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd,
      scrollTrigger: makeScrollTrigger(travelRef) });
    gsap.fromTo(".travel-city", { y: 20, opacity: 0, scale: 0.92 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.08, duration: 0.55, ease: "back.out(1.5)",
        scrollTrigger: makeScrollTrigger(travelRef, "top 72%") });

    /* ── PROFILES ─────────────────────────────────────────── */
    gsap.fromTo(".prof-head", { y: 28, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd,
      scrollTrigger: makeScrollTrigger(profRef) });
    gsap.fromTo(".prof-card", { x: -28, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.1, duration: 0.65,
      ease: "power3.out", scrollTrigger: makeScrollTrigger(profRef, "top 72%") });

    /* ── TESTIMONIALS ─────────────────────────────────────── */
    gsap.fromTo(".test-head", { y: 28, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd,
      scrollTrigger: makeScrollTrigger(testRef) });
    gsap.fromTo(".test-card", { y: 38, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.14, ...sd,
      scrollTrigger: makeScrollTrigger(testRef, "top 72%") });

    /* ── PRICING ──────────────────────────────────────────── */
    gsap.fromTo(".price-inner", { y: 38, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
      scrollTrigger: makeScrollTrigger(priceRef) });

    /* ── Dividers ─────────────────────────────────────────── */
    gsap.utils.toArray<HTMLElement>(".s-line").forEach(el =>
      gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power2.inOut",
        scrollTrigger: { trigger: el, start: "top 92%" } })
    );
  }, [makeScrollTrigger]);

  /* CTA glow pulse */
  useEffect(() => {
    gsap.to(".cta-primary", {
      boxShadow: "0 0 36px rgba(201,162,39,0.5)",
      duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut",
    });
  }, []);

  const gold = "linear-gradient(135deg,#C9A227 0%,#FFE566 50%,#A07818 100%)";

  return (
    <div className="bg-[#020207] text-white overflow-x-hidden selection:bg-amber-800/30">

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 pt-safe-3 pb-4"
        style={{ background: "linear-gradient(to bottom,rgba(2,2,7,.96) 0%,transparent 100%)" }}>
        <Link to="/" className="flex items-center gap-2.5">
          <Mark size={34}/>
          <span className="text-[11px] tracking-[.3em] text-amber-400/90 font-light">AURA</span>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === "es" ? "en" : "es")}
            className="text-[9px] tracking-[.35em] text-amber-500/70 hover:text-amber-400 border border-amber-800/40 px-3 py-1.5 rounded transition-colors uppercase">
            {c.toggle}
          </button>
          <Link to="/login"
            className="hidden sm:block text-[10px] tracking-[.2em] text-stone-400 hover:text-white transition-colors uppercase">
            {c.nav.login}
          </Link>
          <Link to="/registro"
            className="text-[10px] tracking-[.2em] px-4 py-2 border border-amber-700/50 text-amber-400 hover:bg-amber-400/8 rounded transition-all uppercase">
            {c.nav.join}
          </Link>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════ */}
      {/* HERO                                                */}
      {/* ═══════════════════════════════════════════════════ */}
      <section className="hero-section relative min-h-dvh flex flex-col items-center justify-center text-center px-6 pt-20 overflow-hidden">

        <div className="hero-bg absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 90% 80% at 50% 40%, #1c1408 0%, #0d0820 45%, #020207 100%)",
            backgroundSize: "200% 200%",
          }}/>
        <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(201,162,39,0.11) 0%, transparent 65%)" }}/>
        <Particles/>

        <div className="relative z-10 flex flex-col items-center gap-5 max-w-3xl">
          <HeroMark/>

          <p className="hero-tag text-[10px] tracking-[.42em] text-amber-500/60 uppercase mt-1">
            {c.hero.tag}
          </p>

          <div className="overflow-hidden">
            <h1 className="hero-line-1 text-5xl sm:text-6xl md:text-7xl font-thin leading-[1.1] tracking-tight"
              style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {c.hero.h1a}
            </h1>
          </div>
          <div className="overflow-hidden -mt-2">
            <h1 className="hero-line-2 text-5xl sm:text-6xl md:text-7xl font-thin leading-[1.1] tracking-tight text-white/90">
              {c.hero.h1b}
            </h1>
          </div>

          <p className="hero-sub max-w-md text-stone-300 text-base sm:text-lg leading-relaxed font-light mt-1">
            {c.hero.sub}
          </p>

          <div className="hero-ctas flex flex-col sm:flex-row gap-4 mt-3">
            <Link ref={ctaPrimary} to="/registro"
              className="cta-primary px-9 py-4 text-[11px] tracking-[.22em] font-light text-black rounded transition-all hover:scale-[1.03] active:scale-[.98] uppercase"
              style={{ background: gold }}>
              {c.hero.cta}
            </Link>
            <Link ref={ctaSecondary} to="/login"
              className="px-9 py-4 text-[11px] tracking-[.22em] font-light text-amber-400 border border-amber-700/50 rounded hover:border-amber-500/70 transition-all uppercase">
              {c.hero.ctaSub}
            </Link>
          </div>
        </div>

        <div className="scroll-ind absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="w-px h-14 bg-gradient-to-b from-transparent to-amber-700/40"/>
          <div className="w-1 h-1 rounded-full bg-amber-600/60 animate-bounce"/>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* PROOF STRIP                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section className="proof-strip py-24 px-6"
        style={{ background: "radial-gradient(ellipse 90% 100% at 50% 50%, rgba(201,162,39,0.04) 0%, transparent 100%)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-6">
          {c.proof.items.map((p, i) => (
            <div key={i} className="proof-item flex flex-col items-center text-center gap-4">
              <span className="text-5xl font-thin text-amber-800/30 tracking-tighter leading-none">{p.n}</span>
              <div className="w-8 h-px bg-gradient-to-r from-transparent via-amber-600/50 to-transparent"/>
              <h3 className="text-[13px] font-light tracking-widest text-white/90 uppercase">{p.label}</h3>
              <p className="text-stone-400 text-sm leading-relaxed font-light max-w-xs">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* HOW IT WORKS                                        */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={howRef} className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Eyebrow text={c.how.eyebrow} className="how-head text-center"/>
          <h2 className="how-head text-center text-3xl sm:text-4xl font-thin tracking-tight mb-20 whitespace-pre-line"
            style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {c.how.h2}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-14">
            {c.how.steps.map((s, i) => (
              <div key={i} className="how-step">
                <span className="block text-6xl font-thin text-amber-800/25 tracking-tighter mb-5 leading-none">{s.n}</span>
                <div className="w-8 h-px bg-gradient-to-r from-amber-600/50 to-transparent mb-5"/>
                <h3 className="text-[13px] font-light tracking-widest text-white/90 mb-3 uppercase">{s.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed font-light">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ANTI-LEAK                                           */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={leakRef} className="py-32 px-6 relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, #020207 0%, #0a0810 50%, #020207 100%)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(100,50,200,0.06) 0%, transparent 100%)" }}/>
        <div className="max-w-4xl mx-auto relative z-10">
          <Eyebrow text={c.leak.eyebrow} className="leak-ey text-center"/>
          <h2 className="leak-pull text-3xl sm:text-4xl md:text-5xl font-thin leading-[1.25] text-center mb-12 whitespace-pre-line text-white/90">
            {c.leak.pull}
          </h2>
          <div className="max-w-2xl mx-auto space-y-5">
            <p className="leak-body text-stone-300 text-base leading-relaxed font-light text-center">
              {c.leak.body}
            </p>
            <div className="leak-tag flex justify-center">
              <div className="inline-flex items-center gap-3 px-5 py-3 border border-amber-900/30 rounded-full"
                style={{ background: "rgba(201,162,39,0.04)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse"/>
                <p className="text-[9px] tracking-[.35em] text-amber-500/70 uppercase">{c.leak.tag}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FEATURES                                            */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={featRef} className="py-32 px-6"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(201,162,39,0.03) 0%, transparent 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <Eyebrow text={c.features.eyebrow} className="feat-head text-center"/>
          <h2 className="feat-head text-center text-3xl sm:text-4xl font-thin tracking-tight mb-20 text-white/90 max-w-2xl mx-auto whitespace-pre-line">
            {c.features.h2}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {c.features.items.map((f, i) => (
              <div key={i} className="feat-card group relative p-8 rounded border border-amber-900/20 overflow-hidden transition-all duration-500 hover:border-amber-700/40"
                style={{ background: "linear-gradient(145deg,rgba(201,162,39,0.04) 0%,transparent 55%)" }}>
                <div className="absolute top-0 left-0 w-8 h-px bg-gradient-to-r from-amber-600/50 to-transparent"/>
                <div className="absolute top-0 left-0 h-8 w-px bg-gradient-to-b from-amber-600/50 to-transparent"/>
                <div className="text-amber-600/50 mb-5 group-hover:text-amber-500/80 transition-colors duration-300">
                  <Icon name={f.icon} size={19}/>
                </div>
                <h3 className="text-[13px] font-light tracking-widest text-white/90 mb-3 uppercase">{f.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed font-light">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* APP MOCKUP                                          */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={mockupRef} className="py-32 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div className="order-2 lg:order-1">
            <Eyebrow text={lang === "es" ? "La experiencia" : "The experience"} className="mockup-text"/>
            <h2 className="mockup-text text-3xl sm:text-4xl font-thin tracking-tight mb-6 text-white/90">
              {lang === "es"
                ? <>Una red social.<br/>Solo que nadie miente.</>
                : <>A social network.<br/>Where no one lies.</>}
            </h2>
            <p className="mockup-text text-stone-400 text-sm leading-relaxed font-light max-w-md mb-8">
              {lang === "es"
                ? "Feed de fotos y stories. Mensajes directos con audios y fotos de vista única. Encuestas en tiempo real. Eventos por ciudad. Todo lo que esperás de una red social, sin los perfiles falsos."
                : "Photo feed and stories. Direct messages with audio and view-once photos. Real-time polls. City events. Everything you expect from a social network, without the fake profiles."}
            </p>
            <div className="mockup-text flex flex-wrap gap-3">
              {(lang === "es"
                ? ["Feed & Stories", "Mensajes", "Audios", "Encuestas", "Eventos", "Modo viaje"]
                : ["Feed & Stories", "Messages", "Voice notes", "Polls", "Events", "Travel mode"]
              ).map(tag => (
                <span key={tag}
                  className="text-[10px] tracking-[.2em] px-3 py-1.5 border border-amber-900/25 text-amber-500/70 rounded-full uppercase"
                  style={{ background: "rgba(201,162,39,0.03)" }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {/* Phone */}
          <div className="mockup-phone order-1 lg:order-2 flex justify-center" style={{ perspective: "800px" }}>
            <PhoneMockup/>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TRAVEL MODE                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={travelRef} className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <Eyebrow text={c.travel.eyebrow} className="travel-head"/>
              <h2 className="travel-head text-3xl sm:text-4xl font-thin tracking-tight mb-6"
                style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {c.travel.h2}
              </h2>
              <p className="travel-head text-stone-400 text-sm leading-relaxed font-light max-w-md">
                {c.travel.sub}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {c.travel.cities.map((city, i) => (
                <div key={i} className="travel-city flex items-center gap-2.5 px-5 py-3 border border-amber-900/25 rounded-full transition-all duration-400 hover:border-amber-700/50 cursor-default"
                  style={{ background: "rgba(201,162,39,0.025)" }}>
                  <Icon name="plane" size={12}/>
                  <span className="text-[12px] font-light text-white/80 tracking-wide">{city}</span>
                </div>
              ))}
              <div className="travel-city flex items-center gap-2 px-5 py-3 border border-amber-700/30 rounded-full"
                style={{ background: "rgba(201,162,39,0.06)" }}>
                <span className="text-[10px] tracking-[.25em] text-amber-500/70 uppercase">+24 ciudades</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* PROFILES                                            */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={profRef} className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Eyebrow text={c.profiles.eyebrow} className="prof-head text-center"/>
          <h2 className="prof-head text-center text-3xl sm:text-4xl font-thin tracking-tight mb-3 text-white/90">{c.profiles.h2}</h2>
          <p className="prof-head text-center text-sm text-stone-400 font-light tracking-wide mb-16">{c.profiles.sub}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {c.profiles.items.map((p, i) => (
              <div key={i} className="prof-card flex items-center gap-4 px-7 py-6 border border-amber-900/20 rounded transition-all duration-400 hover:border-amber-800/40"
                style={{ background: "rgba(201,162,39,0.018)" }}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`}/>
                <div>
                  <p className="text-[13px] font-light text-white/90 tracking-wide mb-0.5">{p.label}</p>
                  <p className="text-xs text-stone-400 font-light">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TESTIMONIALS                                        */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={testRef} className="py-32 px-6"
        style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(201,162,39,0.04) 0%, transparent 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <Eyebrow text={c.testimonials.eyebrow} className="test-head text-center"/>
          <h2 className="test-head text-center text-3xl sm:text-4xl font-thin tracking-tight mb-16 text-white/90 whitespace-pre-line">
            {c.testimonials.h2}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {c.testimonials.items.map((t, i) => (
              <div key={i} className="test-card relative p-8 border border-amber-900/20 rounded"
                style={{ background: "linear-gradient(145deg,rgba(201,162,39,0.03) 0%,transparent 55%)" }}>
                <span className="absolute top-4 left-6 text-6xl font-thin text-amber-800/12 leading-none select-none pointer-events-none">"</span>
                <p className="text-stone-300 text-sm leading-relaxed font-light italic mt-5 mb-6">{t.q}</p>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-px bg-amber-700/50"/>
                  <p className="text-[10px] tracking-[.18em] text-amber-600/70">{t.by}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* PRICING CTA                                         */}
      {/* ═══════════════════════════════════════════════════ */}
      <Divider/>
      <section ref={priceRef} className="py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 65% at 50% 50%, rgba(201,162,39,0.07) 0%, transparent 100%)" }}/>
        <div className="price-inner max-w-xl mx-auto flex flex-col items-center text-center gap-7 relative z-10">
          <p className="text-[10px] tracking-[.45em] text-amber-500/60 uppercase">{c.pricing.eyebrow}</p>
          <h2 className="text-4xl sm:text-5xl font-thin tracking-tight whitespace-pre-line"
            style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {c.pricing.h2}
          </h2>
          <p className="text-stone-400 text-sm font-light leading-relaxed">{c.pricing.sub}</p>
          <Link to="/registro"
            className="cta-primary mt-2 px-12 py-5 text-[11px] tracking-[.25em] font-light text-black rounded transition-all hover:scale-[1.04] active:scale-[.97] uppercase"
            style={{ background: gold }}>
            {c.pricing.cta}
          </Link>
          <p className="text-[9px] tracking-[.25em] text-amber-600/60 uppercase">{c.pricing.note}</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════ */}
      {/* FOOTER                                              */}
      {/* ═══════════════════════════════════════════════════ */}
      <footer className="border-t border-amber-900/20 px-6 py-16">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <Mark size={44}/>
            <p className="text-[10px] tracking-[.3em] text-amber-600/60 uppercase">{c.footer.tagline}</p>
          </div>
          <div className="flex gap-8">
            {c.footer.links.map(l => {
              const href =
                l === "Privacidad" || l === "Privacy" ? "/privacidad"
                : l === "Términos" || l === "Terms"    ? "/terminos"
                : `mailto:soporte@aurasw.club`;
              const isEmail = href.startsWith("mailto");
              const cls = "text-[10px] tracking-[.22em] text-stone-500 hover:text-amber-500 transition-colors uppercase";
              return isEmail
                ? <a key={l} href={href} className={cls}>{l}</a>
                : <Link key={l} to={href} className={cls}>{l}</Link>;
            })}
          </div>
          <p className="text-[11px] text-stone-500 text-center max-w-sm leading-relaxed font-light">{c.footer.legal}</p>
          <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-900/18 to-transparent"/>
          <p className="text-[9px] text-stone-600 tracking-[.2em]">&copy; {new Date().getFullYear()} {c.footer.copy}</p>
        </div>
      </footer>
    </div>
  );
}
