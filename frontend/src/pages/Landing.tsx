import { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const COPY = {
  es: {
    toggle: "EN",
    nav: { login: "Ingresar", join: "Solicitar acceso" },
    hero: {
      tag: "Identidad verificada  ·  Fotos protegidas  ·  Solo Argentina",
      h1a: "Tus fotos solo van",
      h1b: "donde vos querés.",
      sub: "Acá sabés exactamente con quién estás hablando.",
      cta: "Solicitar acceso",
      ctaSub: "Ya tengo cuenta",
    },
    problem: {
      eyebrow: "El problema real",
      lines: [
        "Perfiles falsos sin consecuencias.",
        "Tus fotos viajan sin control.",
        "Nunca sabés con quién estás hablando.",
      ],
      pivot: "En Aura SW, eso no existe.",
    },
    leak: {
      eyebrow: "La tecnología que cambia todo",
      h2: "Si alguien filtra una foto tuya,\nya sabemos quién fue.",
      body: "Cada imagen subida a Aura SW lleva una firma digital invisible incrustada en los píxeles. No importa cuántas veces se comparta, recorte o edite: la identidad del responsable queda registrada para siempre.",
      tag: "Esteganografía LSB  ·  Watermark visible  ·  ID del usuario",
    },
    kyc: {
      eyebrow: "Verificación real",
      h2: "Para entrar, verificás quién sos.\nPara quedarte, sabés que todos hicieron lo mismo.",
      body: "DNI real. Reconocimiento facial. Sin excepciones. La barrera de entrada alta no es fricción — es exactamente la señal de calidad que buscás.",
      detail: "KYC con MetaMap  ·  DNI  ·  Biometría facial",
    },
    how: {
      eyebrow: "Cómo funciona",
      h2: "Tres pasos.\nDespués, solo personas reales.",
      steps: [
        { n: "01", title: "Verificás tu identidad", body: "DNI y reconocimiento facial. Una vez. Para siempre. Nadie entra fingiendo ser otro." },
        { n: "02", title: "Tu contenido, protegido", body: "Cada foto que subís lleva tu firma invisible. Si alguien la redistribuye, la rastreamos hasta el origen." },
        { n: "03", title: "Conectás con personas reales", body: "Verificadas, cercanas, sin perfiles vacíos. Feed, mensajes, grupos, eventos y modo viaje por toda Argentina." },
      ],
    },
    features: {
      eyebrow: "La plataforma",
      h2: "Una red social completa.\nNadie miente sobre quién es.",
      items: [
        { title: "Feed & Stories", body: "Publicaciones, stories de 24h, carrusel, reacciones. Todo con watermark automático.", icon: "feed" },
        { title: "Mensajes directos", body: "DMs con fotos, audios, vista única. Typing indicators. Reacciones con emoji.", icon: "msg" },
        { title: "Grupos de chat", body: "Conversaciones grupales con personas verificadas. Hasta 50 miembros por grupo.", icon: "group" },
        { title: "Modo viaje", body: "Antes de llegar a otra ciudad, ya sabés quién está ahí. 24+ ciudades de Argentina.", icon: "plane" },
        { title: "Eventos", body: "Eventos comunitarios por ciudad. RSVP verificado. Solo para miembros activos.", icon: "event" },
        { title: "Encuestas en el feed", body: "Polls de hasta 4 opciones con resultados en tiempo real. La comunidad interactúa.", icon: "poll" },
      ],
    },
    travel: {
      eyebrow: "Modo viaje",
      h2: "¿Viajás a Córdoba este finde?",
      sub: "Antes de llegar, ya sabés quién está. Activá el Modo Viaje y descubrí la comunidad verificada en cualquier ciudad de Argentina.",
      cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "Mar del Plata", "Salta", "Bariloche"],
    },
    proof: {
      eyebrow: "Credibilidad",
      h2: "No lo decimos nosotros.\nLo garantiza la tecnología.",
      items: [
        { value: "0", label: "Filtraciones registradas", detail: "Desde el primer día de operación" },
        { value: "KYC", label: "DNI + biometría", detail: "Sin excepciones, sin simulaciones" },
        { value: "LSB", label: "Esteganografía en cada foto", detail: "Firma invisible, imposible de eliminar" },
      ],
    },
    pricing: {
      eyebrow: "Acceso",
      h2: "Una membresía.\nAcceso completo.",
      sub: "Sin niveles. Sin funciones ocultas. Verificación incluida. Todo desde el primer día.",
      cta: "Solicitar acceso",
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
      h1a: "Your photos only go",
      h1b: "where you want.",
      sub: "Here you know exactly who you're talking to.",
      cta: "Request access",
      ctaSub: "I have an account",
    },
    problem: {
      eyebrow: "The real problem",
      lines: [
        "Fake profiles with no consequences.",
        "Your photos travel out of control.",
        "You never know who you're really talking to.",
      ],
      pivot: "In Aura SW, that doesn't exist.",
    },
    leak: {
      eyebrow: "The technology that changes everything",
      h2: "If someone leaks a photo of yours,\nwe already know who it was.",
      body: "Every image uploaded to Aura SW carries an invisible digital signature embedded in the pixels. No matter how many times it's shared, cropped, or edited: the responsible party's identity is permanently recorded.",
      tag: "LSB Steganography  ·  Visible Watermark  ·  User ID",
    },
    kyc: {
      eyebrow: "Real verification",
      h2: "To enter, you verify who you are.\nTo stay, you know everyone else did the same.",
      body: "Real government ID. Facial recognition. No exceptions. The high barrier to entry isn't friction — it's exactly the quality signal you're looking for.",
      detail: "KYC with MetaMap  ·  Government ID  ·  Facial biometrics",
    },
    how: {
      eyebrow: "How it works",
      h2: "Three steps.\nThen only real people.",
      steps: [
        { n: "01", title: "You verify your identity", body: "Government ID and facial recognition. Once. Forever. No one enters pretending to be someone else." },
        { n: "02", title: "Your content, protected", body: "Every photo you upload carries your invisible signature. If someone redistributes it, we trace it back to the source." },
        { n: "03", title: "You connect with real people", body: "Verified, nearby, no empty profiles. Feed, messages, groups, events and travel mode across Argentina." },
      ],
    },
    features: {
      eyebrow: "The platform",
      h2: "A complete social network.\nNo one lies about who they are.",
      items: [
        { title: "Feed & Stories", body: "Posts, 24h stories, carousel, reactions. All with automatic watermark.", icon: "feed" },
        { title: "Direct messages", body: "DMs with photos, audio, view-once. Typing indicators. Emoji reactions.", icon: "msg" },
        { title: "Group chats", body: "Group conversations with verified people. Up to 50 members per group.", icon: "group" },
        { title: "Travel mode", body: "Before arriving in another city, you already know who's there. 24+ cities in Argentina.", icon: "plane" },
        { title: "Events", body: "Community events by city. Verified RSVP. Active members only.", icon: "event" },
        { title: "Feed polls", body: "Up to 4-option polls with real-time results. The community interacts.", icon: "poll" },
      ],
    },
    travel: {
      eyebrow: "Travel mode",
      h2: "Travelling to Córdoba this weekend?",
      sub: "Before you arrive, you already know who's there. Activate Travel Mode and discover the verified community in any city in Argentina.",
      cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "Mar del Plata", "Salta", "Bariloche"],
    },
    proof: {
      eyebrow: "Credibility",
      h2: "We don't just say it.\nThe technology guarantees it.",
      items: [
        { value: "0", label: "Registered leaks", detail: "Since day one of operation" },
        { value: "KYC", label: "ID + biometrics", detail: "No exceptions, no simulations" },
        { value: "LSB", label: "Steganography on every photo", detail: "Invisible signature, impossible to remove" },
      ],
    },
    pricing: {
      eyebrow: "Access",
      h2: "One membership.\nFull access.",
      sub: "No tiers. No hidden features. Verification included. Everything from day one.",
      cta: "Request access",
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

const ICON_PATHS: Record<string, string[]> = {
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  lock:   ["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z","M7 11V7a5 5 0 0110 0v4"],
  plane:  ["M22 2L11 13","M22 2L15 22l-4-9-9-4 20-7z"],
  feed:   ["M4 6h16M4 10h16M4 14h10"],
  msg:    ["M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"],
  group:  ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2","M23 21v-2a4 4 0 00-3-3.87","M9 7a4 4 0 100 8 4 4 0 000-8z","M16 3.13a4 4 0 010 7.75"],
  event:  ["M8 6V4m8 2V4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"],
  poll:   ["M18 20V10M12 20V4M6 20v-6"],
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {(ICON_PATHS[name] || []).map((d, i) => <path key={i} d={d}/>)}
    </svg>
  );
}

function useMagnet(strength = 0.35) {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX-r.left-r.width/2)*strength, y: (e.clientY-r.top-r.height/2)*strength, duration: 0.35, ease: "power2.out" });
    };
    const onLeave = () => gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: "elastic.out(1,0.4)" });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, [strength]);
  return ref;
}

function Particles() {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!wrap.current) return;
    Array.from(wrap.current.children as HTMLCollectionOf<HTMLElement>).forEach(el => {
      gsap.set(el, { x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight, opacity: 0 });
      const dur = 5+Math.random()*9;
      gsap.timeline({ repeat: -1, delay: Math.random()*dur })
        .to(el, { y: `-=${150+Math.random()*200}`, opacity: 0.5, duration: dur*0.4, ease: "none" })
        .to(el, { opacity: 0, duration: dur*0.6, ease: "none" });
      gsap.to(el, { x: `+=${(Math.random()-0.5)*80}`, duration: dur*0.7, repeat: -1, yoyo: true, ease: "sine.inOut" });
    });
  }, []);
  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {Array.from({ length: 28 }).map((_, i) => {
        const s = 0.8+Math.random()*2;
        return <div key={i} style={{ width: s, height: s, borderRadius: "50%", background: "#FFE566", position: "absolute" }}/>;
      })}
    </div>
  );
}

function Mark({ size = 40 }: { size?: number }) {
  return <img src="/brand/logo-full-dark.jpg" alt="AURA" draggable={false} style={{ width: size, height: size, objectFit: "contain", mixBlendMode: "screen" as const, filter: "drop-shadow(0 0 6px rgba(201,162,39,0.4))" }}/>;
}

function HeroMark() {
  return (
    <div className="hero-mark" style={{ position: "relative", width: 200, height: 200 }}>
      <img src="/brand/logo-full-dark.jpg" alt="AURA" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", mixBlendMode: "screen", filter: "drop-shadow(0 0 22px rgba(201,162,39,0.5)) brightness(1.05)" }}/>
    </div>
  );
}

function Divider() {
  return <div className="s-line h-px bg-gradient-to-r from-transparent via-amber-900/28 to-transparent origin-left"/>;
}

function Eyebrow({ text, className = "" }: { text: string; className?: string }) {
  return <p className={`text-[10px] tracking-[.44em] text-amber-500/55 uppercase mb-4 ${className}`}>{text}</p>;
}

export default function Landing() {
  const [lang, setLang] = useState<"es"|"en">("es");
  const c = COPY[lang];

  const problemRef = useRef<HTMLElement>(null);
  const leakRef    = useRef<HTMLElement>(null);
  const kycRef     = useRef<HTMLElement>(null);
  const howRef     = useRef<HTMLElement>(null);
  const featRef    = useRef<HTMLElement>(null);
  const travelRef  = useRef<HTMLElement>(null);
  const proofRef   = useRef<HTMLElement>(null);
  const priceRef   = useRef<HTMLElement>(null);

  const ctaPrimary   = useMagnet(0.38);
  const ctaSecondary = useMagnet(0.28);

  const st = useCallback(
    (ref: React.RefObject<HTMLElement | null>, start = "top 78%") =>
      ({ trigger: ref.current, start, toggleActions: "play none none none" }),
    []
  );

  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true });
    tl.to(".hero-bg", { backgroundPosition: "100% 100%", duration: 9, ease: "sine.inOut" })
      .to(".hero-bg", { backgroundPosition: "0% 50%", duration: 9, ease: "sine.inOut" });
    return () => { tl.kill(); };
  }, []);

  useGSAP(() => {
    const sd = { duration: 0.85, ease: "power3.out" };

    gsap.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(".hero-mark",   { scale: 0.75, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.6 })
      .fromTo(".hero-tag",    { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.7")
      .fromTo(".hero-line-1", { y: 55, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0 }, "-=0.5")
      .fromTo(".hero-line-2", { y: 55, opacity: 0 }, { y: 0, opacity: 1, duration: 1.0 }, "-=0.75")
      .fromTo(".hero-sub",    { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.6")
      .fromTo(".hero-ctas",   { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.45");

    gsap.to(".hero-mark", { y: -18, duration: 4, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".hero-mark", { y: -70, ease: "none", scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 2 } });

    gsap.fromTo(".prob-ey",   { y: 20, opacity: 0 }, { y: 0, opacity: 1, ...sd, scrollTrigger: st(problemRef) });
    gsap.fromTo(".prob-line", { x: -30, opacity: 0 }, { x: 0, opacity: 1, stagger: 0.22, ...sd, scrollTrigger: st(problemRef, "top 74%") });
    gsap.fromTo(".prob-pivot",{ y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", scrollTrigger: st(problemRef, "top 68%") });

    gsap.fromTo(".leak-ey",  { y: 18, opacity: 0 }, { y: 0, opacity: 1, ...sd, scrollTrigger: st(leakRef) });
    gsap.fromTo(".leak-h2",  { clipPath: "inset(0 100% 0 0)", opacity: 0 }, { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 1.3, ease: "power3.out", scrollTrigger: st(leakRef, "top 74%") });
    gsap.fromTo(".leak-body,.leak-tag", { y: 22, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, ...sd, scrollTrigger: st(leakRef, "top 68%") });

    gsap.fromTo(".kyc-item", { y: 32, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.14, ...sd, scrollTrigger: st(kycRef) });

    gsap.fromTo(".how-head", { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd, scrollTrigger: st(howRef) });
    gsap.fromTo(".how-step", { y: 50, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.18, ...sd, scrollTrigger: st(howRef, "top 72%") });

    gsap.fromTo(".feat-head", { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd, scrollTrigger: st(featRef) });
    gsap.fromTo(".feat-card", { y: 40, opacity: 0, scale: 0.97 }, { y: 0, opacity: 1, scale: 1, stagger: 0.1, duration: 0.75, ease: "power3.out", scrollTrigger: st(featRef, "top 72%") });

    gsap.fromTo(".travel-head", { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd, scrollTrigger: st(travelRef) });
    gsap.fromTo(".travel-city", { y: 18, opacity: 0, scale: 0.92 }, { y: 0, opacity: 1, scale: 1, stagger: 0.07, duration: 0.5, ease: "back.out(1.5)", scrollTrigger: st(travelRef, "top 72%") });

    gsap.fromTo(".proof-head", { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.1, ...sd, scrollTrigger: st(proofRef) });
    gsap.fromTo(".proof-item", { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.18, ...sd, scrollTrigger: st(proofRef, "top 72%") });

    gsap.fromTo(".price-inner", { y: 34, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", scrollTrigger: st(priceRef) });

    gsap.utils.toArray<HTMLElement>(".s-line").forEach(el =>
      gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power2.inOut", scrollTrigger: { trigger: el, start: "top 92%" } })
    );
  }, [st]);

  useEffect(() => {
    gsap.to(".cta-primary", { boxShadow: "0 0 34px rgba(201,162,39,0.48)", duration: 1.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
  }, []);

  const gold = "linear-gradient(135deg,#C9A227 0%,#FFE566 50%,#A07818 100%)";

  return (
    <div className="bg-[#020207] text-white overflow-x-hidden selection:bg-amber-800/30">

      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 pt-safe-3 pb-4" style={{ background: "linear-gradient(to bottom,rgba(2,2,7,.96) 0%,transparent 100%)" }}>
        <Link to="/" className="flex items-center gap-2.5">
          <Mark size={32}/>
          <span className="text-[11px] tracking-[.3em] text-amber-400/90 font-light">AURA</span>
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={() => setLang(l => l === "es" ? "en" : "es")} className="text-[9px] tracking-[.35em] text-amber-500/65 hover:text-amber-400 border border-amber-800/35 px-3 py-1.5 rounded transition-colors uppercase">{c.toggle}</button>
          <Link to="/login" className="hidden sm:block text-[10px] tracking-[.2em] text-stone-400 hover:text-white transition-colors uppercase">{c.nav.login}</Link>
          <Link to="/registro" className="text-[10px] tracking-[.2em] px-4 py-2 border border-amber-700/45 text-amber-400 hover:bg-amber-400/8 rounded transition-all uppercase">{c.nav.join}</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-section relative min-h-dvh flex flex-col items-center justify-center text-center px-6 pt-20 overflow-hidden">
        <div className="hero-bg absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 80% at 50% 40%, #1c1408 0%, #0d0820 45%, #020207 100%)", backgroundSize: "200% 200%" }}/>
        <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(201,162,39,0.10) 0%, transparent 65%)" }}/>
        <Particles/>
        <div className="relative z-10 flex flex-col items-center gap-5 max-w-3xl">
          <HeroMark/>
          <p className="hero-tag text-[10px] tracking-[.42em] text-amber-500/55 uppercase mt-1">{c.hero.tag}</p>
          <div className="overflow-hidden">
            <h1 className="hero-line-1 text-5xl sm:text-6xl md:text-7xl font-thin leading-[1.08] tracking-tight" style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.hero.h1a}</h1>
          </div>
          <div className="overflow-hidden -mt-3">
            <h1 className="hero-line-2 text-5xl sm:text-6xl md:text-7xl font-thin leading-[1.08] tracking-tight" style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.hero.h1b}</h1>
          </div>
          <p className="hero-sub text-xl sm:text-2xl font-thin text-white/75 tracking-wide mt-1">{c.hero.sub}</p>
          <div className="hero-ctas flex flex-col sm:flex-row gap-4 mt-4">
            <Link ref={ctaPrimary} to="/registro" className="cta-primary px-9 py-4 text-[11px] tracking-[.22em] font-light text-black rounded transition-all hover:scale-[1.03] active:scale-[.98] uppercase" style={{ background: gold }}>{c.hero.cta}</Link>
            <Link ref={ctaSecondary} to="/login" className="px-9 py-4 text-[11px] tracking-[.22em] font-light text-amber-400 border border-amber-700/45 rounded hover:border-amber-500/65 transition-all uppercase">{c.hero.ctaSub}</Link>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-transparent to-amber-700/35"/>
          <div className="w-1 h-1 rounded-full bg-amber-600/55 animate-bounce"/>
        </div>
      </section>

      {/* PROBLEMA */}
      <Divider/>
      <section ref={problemRef} className="py-28 px-6 relative overflow-hidden" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(120,30,30,0.06) 0%, transparent 100%)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <Eyebrow text={c.problem.eyebrow} className="prob-ey"/>
          <div className="space-y-5 mb-10">
            {c.problem.lines.map((line, i) => (
              <p key={i} className="prob-line text-2xl sm:text-3xl font-thin text-white/50 leading-snug tracking-tight">
                <span className="inline-block w-4 h-px bg-white/20 mr-3 mb-1 align-middle"/>
                {line}
              </p>
            ))}
          </div>
          <p className="prob-pivot text-2xl sm:text-3xl font-thin tracking-tight" style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.problem.pivot}</p>
        </div>
      </section>

      {/* ANTI-LEAK */}
      <Divider/>
      <section ref={leakRef} className="py-32 px-6 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #020207 0%, #07060f 50%, #020207 100%)" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(100,50,200,0.06) 0%, transparent 100%)" }}/>
        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <Eyebrow text={c.leak.eyebrow} className="leak-ey"/>
          <h2 className="leak-h2 text-3xl sm:text-4xl md:text-5xl font-thin leading-[1.2] mb-12 whitespace-pre-line text-white/90">{c.leak.h2}</h2>
          <p className="leak-body text-stone-300 text-base sm:text-lg leading-relaxed font-light max-w-2xl mx-auto mb-8">{c.leak.body}</p>
          <div className="leak-tag flex justify-center">
            <div className="inline-flex items-center gap-3 px-5 py-3 border border-amber-900/28 rounded-full" style={{ background: "rgba(201,162,39,0.04)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-pulse"/>
              <p className="text-[9px] tracking-[.34em] text-amber-500/65 uppercase">{c.leak.tag}</p>
            </div>
          </div>
        </div>
      </section>

      {/* KYC */}
      <Divider/>
      <section ref={kycRef} className="py-32 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="kyc-item">
            <Eyebrow text={c.kyc.eyebrow}/>
            <h2 className="text-3xl sm:text-4xl font-thin tracking-tight mb-6 whitespace-pre-line text-white/90 leading-[1.25]">{c.kyc.h2}</h2>
            <p className="text-stone-400 text-sm leading-relaxed font-light max-w-md mb-6">{c.kyc.body}</p>
            <div className="inline-flex items-center gap-3 px-4 py-2.5 border border-amber-900/28 rounded-full" style={{ background: "rgba(201,162,39,0.04)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500/60"/>
              <p className="text-[9px] tracking-[.3em] text-amber-500/65 uppercase">{c.kyc.detail}</p>
            </div>
          </div>
          <div className="kyc-item grid grid-cols-1 gap-4">
            {[
              { icon: "shield", text: lang === "es" ? "Verificación real con DNI" : "Real verification with ID" },
              { icon: "lock",   text: lang === "es" ? "Biometría facial obligatoria" : "Mandatory facial biometrics" },
              { icon: "shield", text: lang === "es" ? "Sin excepciones, sin simulaciones" : "No exceptions, no simulations" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border border-amber-900/20 rounded-xl" style={{ background: "rgba(201,162,39,0.025)" }}>
                <div className="text-amber-600/55 flex-shrink-0"><Icon name={item.icon} size={16}/></div>
                <p className="text-sm font-light text-white/80 tracking-wide">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <Divider/>
      <section ref={howRef} className="py-32 px-6" style={{ background: "radial-gradient(ellipse 80% 55% at 50% 50%, rgba(201,162,39,0.03) 0%, transparent 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <Eyebrow text={c.how.eyebrow} className="how-head text-center"/>
          <h2 className="how-head text-center text-3xl sm:text-4xl font-thin tracking-tight mb-20 whitespace-pre-line" style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.how.h2}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-14">
            {c.how.steps.map((s, i) => (
              <div key={i} className="how-step">
                <span className="block text-6xl font-thin text-amber-800/22 tracking-tighter mb-5 leading-none">{s.n}</span>
                <div className="w-8 h-px bg-gradient-to-r from-amber-600/50 to-transparent mb-5"/>
                <h3 className="text-[13px] font-light tracking-widest text-white/88 mb-3 uppercase">{s.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed font-light">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <Divider/>
      <section ref={featRef} className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <Eyebrow text={c.features.eyebrow} className="feat-head text-center"/>
          <h2 className="feat-head text-center text-3xl sm:text-4xl font-thin tracking-tight mb-20 text-white/88 max-w-2xl mx-auto whitespace-pre-line">{c.features.h2}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {c.features.items.map((f, i) => (
              <div key={i} className="feat-card group relative p-7 rounded border border-amber-900/18 overflow-hidden transition-all duration-500 hover:border-amber-700/36" style={{ background: "linear-gradient(145deg,rgba(201,162,39,0.035) 0%,transparent 55%)" }}>
                <div className="absolute top-0 left-0 w-6 h-px bg-gradient-to-r from-amber-600/45 to-transparent"/>
                <div className="absolute top-0 left-0 h-6 w-px bg-gradient-to-b from-amber-600/45 to-transparent"/>
                <div className="text-amber-600/48 mb-4 group-hover:text-amber-500/75 transition-colors duration-300"><Icon name={f.icon} size={18}/></div>
                <h3 className="text-[12px] font-light tracking-widest text-white/88 mb-2 uppercase">{f.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed font-light">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRAVEL */}
      <Divider/>
      <section ref={travelRef} className="py-32 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <Eyebrow text={c.travel.eyebrow} className="travel-head"/>
            <h2 className="travel-head text-3xl sm:text-4xl font-thin tracking-tight mb-6" style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.travel.h2}</h2>
            <p className="travel-head text-stone-400 text-sm leading-relaxed font-light max-w-md">{c.travel.sub}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {c.travel.cities.map((city, i) => (
              <div key={i} className="travel-city flex items-center gap-2 px-4 py-2.5 border border-amber-900/22 rounded-full cursor-default" style={{ background: "rgba(201,162,39,0.022)" }}>
                <Icon name="plane" size={11}/>
                <span className="text-[12px] font-light text-white/78 tracking-wide">{city}</span>
              </div>
            ))}
            <div className="travel-city flex items-center px-4 py-2.5 border border-amber-700/28 rounded-full" style={{ background: "rgba(201,162,39,0.055)" }}>
              <span className="text-[10px] tracking-[.22em] text-amber-500/65 uppercase">+24 ciudades</span>
            </div>
          </div>
        </div>
      </section>

      {/* CREDIBILIDAD */}
      <Divider/>
      <section ref={proofRef} className="py-32 px-6" style={{ background: "radial-gradient(ellipse 75% 55% at 50% 50%, rgba(201,162,39,0.04) 0%, transparent 100%)" }}>
        <div className="max-w-5xl mx-auto">
          <Eyebrow text={c.proof.eyebrow} className="proof-head text-center"/>
          <h2 className="proof-head text-center text-3xl sm:text-4xl font-thin tracking-tight mb-20 text-white/88 whitespace-pre-line max-w-2xl mx-auto">{c.proof.h2}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {c.proof.items.map((p, i) => (
              <div key={i} className="proof-item text-center">
                <p className="text-5xl sm:text-6xl font-thin mb-3" style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{p.value}</p>
                <div className="w-8 h-px bg-gradient-to-r from-transparent via-amber-600/40 to-transparent mx-auto mb-3"/>
                <p className="text-[13px] font-light tracking-widest text-white/85 uppercase mb-2">{p.label}</p>
                <p className="text-xs text-stone-500 font-light">{p.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <Divider/>
      <section ref={priceRef} className="py-40 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 65% at 50% 50%, rgba(201,162,39,0.07) 0%, transparent 100%)" }}/>
        <div className="price-inner max-w-xl mx-auto flex flex-col items-center text-center gap-7 relative z-10">
          <Eyebrow text={c.pricing.eyebrow}/>
          <h2 className="text-4xl sm:text-5xl font-thin tracking-tight whitespace-pre-line" style={{ background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.pricing.h2}</h2>
          <p className="text-stone-400 text-sm font-light leading-relaxed">{c.pricing.sub}</p>
          <Link to="/registro" className="cta-primary mt-2 px-12 py-5 text-[11px] tracking-[.25em] font-light text-black rounded transition-all hover:scale-[1.04] active:scale-[.97] uppercase" style={{ background: gold }}>{c.pricing.cta}</Link>
          <p className="text-[9px] tracking-[.24em] text-amber-600/55 uppercase">{c.pricing.note}</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-amber-900/18 px-6 py-16">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <Mark size={42}/>
            <p className="text-[10px] tracking-[.3em] text-amber-600/55 uppercase">{c.footer.tagline}</p>
          </div>
          <div className="flex gap-8">
            {c.footer.links.map(l => {
              const href = l === "Privacidad" || l === "Privacy" ? "/privacidad" : l === "Términos" || l === "Terms" ? "/terminos" : "mailto:soporte@aurasw.club";
              const cls = "text-[10px] tracking-[.22em] text-stone-500 hover:text-amber-500 transition-colors uppercase";
              return href.startsWith("mailto") ? <a key={l} href={href} className={cls}>{l}</a> : <Link key={l} to={href} className={cls}>{l}</Link>;
            })}
          </div>
          <p className="text-[11px] text-stone-500 text-center max-w-sm leading-relaxed font-light">{c.footer.legal}</p>
          <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-900/16 to-transparent"/>
          <p className="text-[9px] text-stone-600 tracking-[.2em]">&copy; {new Date().getFullYear()} {c.footer.copy}</p>
        </div>
      </footer>
    </div>
  );
}
