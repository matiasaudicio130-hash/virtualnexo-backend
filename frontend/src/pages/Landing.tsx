import { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* ── Copy ──────────────────────────────────────────────────── */
const COPY = {
  es: {
    toggle: "EN",
    nav: { login: "Ingresar", join: "Pedí tu invitación" },
    hero: {
      tag: "La comunidad lifestyle adulta verificada de Argentina.",
      lines: ["Solo", "los reales."],
      sub: "Acá todos son quienes dicen ser. Y todo lo que compartís tiene firma.",
      cta: "Pedí tu invitación",
      ctaSub: "Ya soy parte",
    },
    movie: [
      { title: "Lo sabés,\npero no lo decís.", body: "Cualquiera sube cualquier foto. Cualquiera dice ser quien no es. Y vos terminás perdiendo el tiempo — o algo peor." },
      { title: "Lo resolvimos\nde verdad.", body: "Verificación con DNI y biometría antes de entrar. Y cada foto lleva una firma digital invisible — si se filtra, el origen queda registrado." },
      { title: "El nivel\nadentro.", body: "Personas reales, verificadas, que eligieron algo diferente. Profesionales, viajeros, personas con criterio — de Buenos Aires y de 24 ciudades más de Argentina." },
    ],
    leak: {
      eyebrow: "Tu firma. En cada foto.",
      h2: "Si una foto tuya se filtra,\nsabemos exactamente de dónde salió.",
      body: "Esteganografía: una firma digital invisible se inscribe en cada foto que compartís. No se ve, no se borra, y sobrevive incluso si alguien la captura con otra cámara. El que filtra, queda expuesto.",
    },
    kyc: {
      h1: "Acá no entra cualquiera.",
      h2: "Y eso lo cambia absolutamente todo.",
      cards: [
        { icon: "👤", title: "DNI real", body: "Documento de identidad verificado. No alcanza con una selfie." },
        { icon: "🔬", title: "Biometría facial", body: "Tu cara, confirmada en tiempo real. Sin fotos viejas, sin trucos." },
        { icon: "✓",  title: "Sin simulaciones", body: "Aprobación humana antes de activar tu perfil. Cero atajos." },
      ],
    },
    features: [
      { n: "01", title: "Identidad confirmada", body: "Sabés con certeza quién es la persona del otro lado." },
      { n: "02", title: "Tus fotos, firmadas", body: "Cada imagen que compartís lleva una marca invisible e irrevocable." },
      { n: "03", title: "Vos decidís quién te ve", body: "Elegís tu audiencia antes de que te encuentren." },
      { n: "04", title: "Conversaciones que importan", body: "Con personas que ya verificaron ser quienes dicen ser." },
      { n: "05", title: "Solo contenido verificado", body: "Nada de perfiles basura porque ninguno puede existir acá." },
      { n: "06", title: "El nivel que buscabas", body: "Una comunidad donde entrar ya dice algo de quién sos." },
    ],
    stats: [
      { value: 0,   suffix: "",  label: "filtraciones registradas en la historia de la plataforma" },
      { value: 100, suffix: "%", label: "de los perfiles, verificados con biometría y DNI real" },
      { value: 1,   suffix: "°", label: "comunidad lifestyle adulta verificada de Argentina" },
    ],
    pricing: {
      eyebrow: "Acceso",
      h2: "Si llegaste hasta acá,\nya sabés que querés entrar.",
      body: "El proceso de verificación es privado, seguro y toma menos de 5 minutos. Lo que viene después, vale cada segundo.",
      cta: "Pedí tu invitación",
      note: "Verificación requerida · Solo mayores de 18 · Argentina",
    },
    footer: {
      tagline: "La comunidad adulta verificada de Argentina.",
      links: [["Privacidad", "/privacidad"], ["Términos", "/terminos"], ["Contacto", "mailto:soporte@aurasw.club"]],
    },
  },
  en: {
    toggle: "ES",
    nav: { login: "Sign in", join: "Request invite" },
    hero: {
      tag: "Argentina's verified adult lifestyle community.",
      lines: ["Only", "the real ones."],
      sub: "Everyone here is who they say they are. And everything you share has a signature.",
      cta: "Request your invite",
      ctaSub: "I'm already in",
    },
    movie: [
      { title: "You know it.\nYou just don't say it.", body: "Anyone can upload anything. Anyone can be anyone. And you end up wasting time — or worse." },
      { title: "We actually\nfixed it.", body: "ID and biometric verification before entry. And every photo carries an invisible digital signature — if it leaks, the source is on record." },
      { title: "The level\ninside.", body: "Real, verified people who chose something different. Professionals, travelers, people with standards — from Buenos Aires and 24 more cities across Argentina." },
    ],
    leak: {
      eyebrow: "Your signature. In every photo.",
      h2: "If a photo of yours gets leaked,\nwe know exactly where it came from.",
      body: "Steganography: an invisible digital signature is written into every photo you share. It can't be seen, can't be removed, and survives even if captured by another camera. The leaker gets exposed.",
    },
    kyc: {
      h1: "Not everyone gets in.",
      h2: "And that changes absolutely everything.",
      cards: [
        { icon: "👤", title: "Real ID", body: "Government-issued identity document verified. A selfie is not enough." },
        { icon: "🔬", title: "Facial biometrics", body: "Your face, confirmed in real time. No old photos, no tricks." },
        { icon: "✓",  title: "No simulations", body: "Human approval before your profile is activated. Zero shortcuts." },
      ],
    },
    features: [
      { n: "01", title: "Confirmed identity", body: "You know with certainty who's on the other side." },
      { n: "02", title: "Your photos, signed", body: "Every image you share carries an invisible, irrevocable mark." },
      { n: "03", title: "You decide who sees you", body: "Choose your audience before they find you." },
      { n: "04", title: "Conversations that matter", body: "With people who already verified they are who they say they are." },
      { n: "05", title: "Verified content only", body: "No junk profiles because none can exist here." },
      { n: "06", title: "The level you were looking for", body: "A community where getting in already says something about who you are." },
    ],
    stats: [
      { value: 0,   suffix: "",  label: "leaks recorded in the platform's history" },
      { value: 100, suffix: "%", label: "of profiles verified with biometrics and real ID" },
      { value: 1,   suffix: "°", label: "verified adult lifestyle community in Argentina" },
    ],
    pricing: {
      eyebrow: "Access",
      h2: "If you made it this far,\nyou already know you want in.",
      body: "The verification process is private, secure and takes less than 5 minutes. What comes after is worth every second.",
      cta: "Request your invite",
      note: "Verification required · 18+ only · Argentina",
    },
    footer: {
      tagline: "Argentina's verified adult community.",
      links: [["Privacy", "/privacidad"], ["Terms", "/terminos"], ["Contact", "mailto:soporte@aurasw.club"]],
    },
  },
} as const;

const GOLD = "linear-gradient(135deg,#C9A227 0%,#FFE566 50%,#A07818 100%)";
const SCENE_ACCENT = ["#ef4444", "#8B5CF6", "#C9A227"] as const;

/* ── Magnet ─────────────────────────────────────────────────── */
function useMagnet(strength = 0.4) {
  const r = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = r.current; if (!el) return;
    const mv = (e: MouseEvent) => {
      const b = el.getBoundingClientRect();
      gsap.to(el, { x: (e.clientX-b.left-b.width/2)*strength, y: (e.clientY-b.top-b.height/2)*strength, duration: 0.35, ease: "power2.out" });
    };
    const lv = () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1,0.4)" });
    el.addEventListener("mousemove", mv); el.addEventListener("mouseleave", lv);
    return () => { el.removeEventListener("mousemove", mv); el.removeEventListener("mouseleave", lv); };
  }, [strength]);
  return r;
}

/* ── Canvas particle animation ──────────────────────────────── */
interface Pt { sx: number; sy: number; tx: number; ty: number; r: number }

function buildParticles(W: number, H: number): Pt[] {
  const count = 180;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const rings = [40, 60, 80, 100, 120];
    const ri = rings[i % rings.length];
    return { sx: Math.random() * W, sy: Math.random() * H, tx: W/2 + Math.cos(a)*ri, ty: H/2 + Math.sin(a)*ri, r: 1.5 + Math.random()*1.5 };
  });
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeInOut(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
function lerpColorStr(c1: string, c2: string, t: number, alpha = 1) {
  const [r1,g1,b1] = hexToRgb(c1), [r2,g2,b2] = hexToRgb(c2);
  const r = Math.round(lerp(r1,r2,t)), g = Math.round(lerp(g1,g2,t)), b = Math.round(lerp(b1,b2,t));
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

function renderCanvas(canvas: HTMLCanvasElement, pts: Pt[], progress: number) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // bg gradient
  const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W,H)*0.5);
  const bgColor = progress < 0.5
    ? lerpColorStr("#200010", "#10082a", progress*2, 0.4)
    : lerpColorStr("#10082a", "#1c1408", (progress-0.5)*2, 0.4);
  g.addColorStop(0, bgColor); g.addColorStop(1, "transparent");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const ep = easeInOut(Math.min(1, progress * 1.5));
  const fgColor = progress < 0.5
    ? lerpColorStr(SCENE_ACCENT[0], SCENE_ACCENT[1], Math.min(1, progress*2))
    : lerpColorStr(SCENE_ACCENT[1], SCENE_ACCENT[2], Math.min(1, (progress-0.5)*2));

  pts.forEach(p => {
    const x = lerp(p.sx, p.tx, ep);
    const y = lerp(p.sy, p.ty, ep);
    const alpha = 0.25 + ep*0.65;
    ctx.beginPath();
    ctx.arc(x, y, p.r * (0.5 + ep*0.8), 0, Math.PI*2);
    ctx.fillStyle = fgColor;
    ctx.globalAlpha = alpha;
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Center glow at end
  if (progress > 0.75) {
    const glow = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 100);
    glow.addColorStop(0, `rgba(201,162,39,${(progress-0.75)*1.6})`);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  }
}

/* ── Counter ────────────────────────────────────────────────── */
function Counter({ target, suffix }: { target: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fired = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const st = ScrollTrigger.create({
      trigger: ref.current, start: "top 85%", once: true,
      onEnter: () => {
        if (fired.current) return;
        fired.current = true;
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 2, ease: "power2.out",
          onUpdate: () => { if (ref.current) ref.current.textContent = Math.round(obj.v) + suffix; },
          onComplete: () => { if (ref.current) ref.current.textContent = target + suffix; },
        });
      },
    });
    return () => st.kill();
  }, [target, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════ */
export default function Landing() {
  const [lang, setLang] = useState<"es"|"en">("es");
  const c = COPY[lang];

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const movieRef    = useRef<HTMLDivElement>(null);
  const ptsRef      = useRef<Pt[]>([]);
  const scene0Ref   = useRef<HTMLDivElement>(null);
  const scene1Ref   = useRef<HTMLDivElement>(null);
  const scene2Ref   = useRef<HTMLDivElement>(null);
  const featRef     = useRef<HTMLDivElement>(null);
  const featTrackRef = useRef<HTMLDivElement>(null);

  const cta1 = useMagnet(0.38);
  const cta2 = useMagnet(0.25);
  const ctaBottom = useMagnet(0.35);

  /* Init canvas */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      canvas.width  = canvas.offsetWidth  || window.innerWidth;
      canvas.height = canvas.offsetHeight || window.innerHeight;
      ptsRef.current = buildParticles(canvas.width, canvas.height);
      renderCanvas(canvas, ptsRef.current, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useGSAP(() => {
    /* ── Hero entrance ──────────────────────────────────── */
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(".h-logo", { scale: 0.5, opacity: 0, filter: "blur(30px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 2 })
      .fromTo(".h-tag",  { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.9")
      .fromTo(".h-line", { y: 100, opacity: 0, skewY: 6 }, { y: 0, opacity: 1, skewY: 0, duration: 1, stagger: 0.13 }, "-=0.5")
      .fromTo(".h-sub",  { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.5")
      .fromTo(".h-ctas", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.4");

    gsap.to(".h-logo", { y: -14, duration: 5, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".h-logo", { y: -100, ease: "none", scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 2 } });
    gsap.to(".glow-cta", { boxShadow: "0 0 40px rgba(201,162,39,0.55)", duration: 2, repeat: -1, yoyo: true, ease: "sine.inOut" });

    // Ring pulse
    gsap.to(".logo-ring", { scale: 1.08, opacity: 0.4, duration: 2, ease: "sine.inOut", repeat: -1, yoyo: true });

    // Glitch effect — fires randomly every few seconds
    const fireGlitch = () => {
      const tl = gsap.timeline({
        onComplete: () => gsap.delayedCall(3 + Math.random() * 5, fireGlitch),
      });
      tl.set(".glitch-r", { x: -4, opacity: 0.6 })
        .set(".glitch-c", { x: 4,  opacity: 0.5 })
        .to([".glitch-r", ".glitch-c"], { opacity: 0, duration: 0.08 })
        .set(".glitch-r", { x: 3, opacity: 0.5 })
        .set(".glitch-c", { x: -3, opacity: 0.4 })
        .to([".glitch-r", ".glitch-c"], { opacity: 0, duration: 0.06 })
        .set(".glitch-r", { x: -6, y: 2, opacity: 0.7 })
        .to([".glitch-r", ".glitch-c"], { opacity: 0, x: 0, y: 0, duration: 0.1 });
    };
    gsap.delayedCall(2.5, fireGlitch);

    /* ── Canvas scroll movie (pinned) ───────────────────── */
    const canvas = canvasRef.current;
    const movie = movieRef.current;
    if (canvas && movie) {
      const sceneRefs = [scene0Ref.current, scene1Ref.current, scene2Ref.current];
      gsap.set(sceneRefs[0], { opacity: 1, y: 0 });
      gsap.set([sceneRefs[1], sceneRefs[2]], { opacity: 0, y: 30 });

      ScrollTrigger.create({
        trigger: movie,
        start: "top top",
        end: "+=160%",
        pin: true,
        scrub: 0.8,
        onUpdate: (self) => {
          const p = self.progress;
          renderCanvas(canvas, ptsRef.current, p);
          sceneRefs.forEach((sc, i) => {
            if (!sc) return;
            const center = i / 3 + 1/6;
            const dist = Math.abs(p - center);
            const op = Math.max(0, 1 - dist * 6);
            const yv = (p - center) * -40;
            gsap.set(sc, { opacity: op, y: yv });
          });
        },
      });
    }

    /* ── Anti-leak reveal ───────────────────────────────── */
    gsap.fromTo(".leak-visual",
      { clipPath: "inset(100% 0% 0% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power4.out",
        scrollTrigger: { trigger: ".leak-visual", start: "top 80%" } }
    );
    gsap.fromTo(".leak-text > *",
      { x: -50, opacity: 0 },
      { x: 0, opacity: 1, stagger: 0.15, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: ".leak-section", start: "top 72%" } }
    );

    /* ── KYC cards 3D hover + reveal ───────────────────── */
    gsap.fromTo(".kyc-card",
      { y: 70, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.14, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: ".kyc-section", start: "top 72%" } }
    );
    gsap.utils.toArray<HTMLElement>(".kyc-card").forEach(card => {
      const onMove = (e: MouseEvent) => {
        const b = card.getBoundingClientRect();
        gsap.to(card, { rotateX: ((e.clientY-b.top)/b.height-0.5)*-18, rotateY: ((e.clientX-b.left)/b.width-0.5)*18, duration: 0.4, ease: "power2.out", transformPerspective: 900 });
      };
      const onLeave = () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1,0.4)" });
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
    });

    /* ── Features horizontal scroll (pinned) ───────────── */
    const feat = featRef.current;
    const track = featTrackRef.current;
    if (feat && track) {
      const getTrackWidth = () => track.scrollWidth - feat.offsetWidth;
      gsap.to(track, {
        x: () => -getTrackWidth(),
        ease: "none",
        scrollTrigger: {
          trigger: feat,
          start: "top top",
          end: () => `+=${getTrackWidth()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    }

    /* ── Feature cards stagger reveal ──────────────────── */
    gsap.fromTo(".feat-card",
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.1, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: ".feat-eyebrow", start: "top 80%" } }
    );

    /* ── Stats ──────────────────────────────────────────── */
    gsap.fromTo(".stat-item",
      { y: 50, opacity: 0, scale: 0.88 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.2, duration: 1, ease: "back.out(1.5)",
        scrollTrigger: { trigger: ".stats-section", start: "top 75%" } }
    );

    /* ── CTA final ──────────────────────────────────────── */
    gsap.fromTo(".cta-item",
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.18, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: ".cta-section", start: "top 72%" } }
    );

    /* ── Dividers ───────────────────────────────────────── */
    gsap.utils.toArray<HTMLElement>(".s-div").forEach(el =>
      gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power2.inOut", scrollTrigger: { trigger: el, start: "top 92%" } })
    );

  }, []);

  /* ── Inline style helpers ───────────────────────────────── */
  const T = (s: React.CSSProperties): React.CSSProperties => s;

  return (
    <div style={{ background: "#020207", color: "#fff", overflowX: "hidden", fontFamily: "'Inter', sans-serif" }}>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "linear-gradient(to bottom,rgba(2,2,7,.95),transparent)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img src="/brand/logo-transparent.png" alt="AURA" style={{ width: 28, height: 28, objectFit: "contain", mixBlendMode: "screen", filter: "drop-shadow(0 0 8px rgba(201,162,39,0.6))" }}/>
          <span style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(201,162,39,0.9)", fontWeight: 300 }}>AURA</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setLang(l => l === "es" ? "en" : "es")} style={{ fontSize: 9, letterSpacing: "0.35em", color: "rgba(201,162,39,0.65)", border: "1px solid rgba(201,162,39,0.25)", padding: "5px 12px", borderRadius: 3, background: "transparent", cursor: "pointer" }}>{c.toggle}</button>
          <Link to="/login" style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(200,200,200,0.6)", textDecoration: "none", display: "none" }} className="sm:block">{c.nav.login}</Link>
          <Link to="/registro" style={{ fontSize: 10, letterSpacing: "0.2em", padding: "7px 16px", border: "1px solid rgba(201,162,39,0.4)", color: "rgba(201,162,39,0.9)", borderRadius: 3, textDecoration: "none", fontWeight: 300 }}>{c.nav.join}</Link>
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════ */}
      <section className="hero-section" style={{ position: "relative", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px 60px", overflow: "hidden" }}>
        {/* Video background */}
        <video
          autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, opacity: 0.65 }}
        >
          <source src="/brand/hero-bg.mp4.mp4" type="video/mp4"/>
        </video>
        {/* Dark overlay sobre el video */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(2,2,7,0.55) 0%, rgba(2,2,7,0.3) 50%, rgba(2,2,7,0.85) 100%)", zIndex: 1 }}/>
        {/* Gradient lateral para profundidad */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 70% at 50% 40%, rgba(28,20,8,0.5) 0%, transparent 70%)", zIndex: 1 }}/>
        {/* Grid muy sutil — solo para desktop */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,162,39,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.012) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none", zIndex: 2 }}/>
        {/* Orb glow center */}
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(201,162,39,0.08) 0%, transparent 65%)", pointerEvents: "none", zIndex: 2 }}/>

        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, maxWidth: 900 }}>

          {/* Logo premium — glitch + scanlines */}
          <div className="h-logo" style={{ position: "relative", width: 140, height: 140 }}>
            {/* Scanlines overlay */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px)", zIndex: 3, pointerEvents: "none" }}/>
            {/* Outer glow ring */}
            <div className="logo-ring" style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "1px solid rgba(201,162,39,0.2)", zIndex: 0 }}/>
            <div style={{ position: "absolute", inset: -24, borderRadius: "50%", border: "1px solid rgba(201,162,39,0.08)", zIndex: 0 }}/>
            {/* Main image — screen blend elimina el fondo negro del JPG */}
            <img src="/brand/logo-transparent.png" alt="AURA"
              style={{ width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 2,
                       mixBlendMode: "screen" as const,
                       filter: "drop-shadow(0 0 20px rgba(201,162,39,0.8)) drop-shadow(0 0 50px rgba(201,162,39,0.4)) brightness(1.2) contrast(1.1) saturate(1.2)" }}/>
            {/* Glitch layer 1 — red channel */}
            <img src="/brand/logo-transparent.png" alt="" aria-hidden
              className="glitch-r"
              style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", inset: 0, zIndex: 1,
                       filter: "drop-shadow(0 0 0px #ff0000) saturate(0) brightness(2)", opacity: 0,
                       mixBlendMode: "screen" as const }}/>
            {/* Glitch layer 2 — cyan channel */}
            <img src="/brand/logo-transparent.png" alt="" aria-hidden
              className="glitch-c"
              style={{ width: "100%", height: "100%", objectFit: "contain", position: "absolute", inset: 0, zIndex: 1,
                       filter: "drop-shadow(0 0 0px #00ffff) saturate(0) brightness(2)", opacity: 0,
                       mixBlendMode: "screen" as const }}/>
          </div>

          {/* Tag */}
          <p className="h-tag" style={{ fontSize: 9, letterSpacing: "0.5em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", fontWeight: 300 }}>{c.hero.tag}</p>

          {/* H1 lines */}
          <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 4 }}>
            {c.hero.lines.map((line, i) => (
              <div key={i} style={{ overflow: "hidden" }}>
                <h1 className="h-line" style={{
                  fontSize: "clamp(52px, 11vw, 112px)", fontWeight: 100, lineHeight: 1.05,
                  letterSpacing: "-0.025em", display: "block",
                  ...(i % 2 === 0 ? { background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : { color: "rgba(255,255,255,0.88)" }),
                }}>
                  {line}
                </h1>
              </div>
            ))}
          </div>

          <p className="h-sub" style={{ fontSize: "clamp(16px, 2.2vw, 22px)", color: "rgba(255,255,255,0.6)", fontWeight: 200, letterSpacing: "0.02em", maxWidth: 480 }}>{c.hero.sub}</p>

          <div className="h-ctas" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <Link ref={cta1} to="/registro" className="glow-cta" style={{ padding: "15px 40px", background: GOLD, color: "#000", fontWeight: 400, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", borderRadius: 3, textDecoration: "none" }}>{c.hero.cta}</Link>
            <Link ref={cta2} to="/login" style={{ padding: "15px 40px", border: "1px solid rgba(201,162,39,0.35)", color: "rgba(201,162,39,0.85)", fontWeight: 300, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", borderRadius: 3, textDecoration: "none" }}>{c.hero.ctaSub}</Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10 }}>
          <div style={{ width: 1, height: 48, background: "linear-gradient(to bottom, transparent, rgba(201,162,39,0.45))" }}/>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(201,162,39,0.6)", animation: "aura-bounce 1.4s ease-in-out infinite" }}/>
        </div>
      </section>

      {/* ══ SCROLL MOVIE ════════════════════════════════════ */}
      <div ref={movieRef} style={{ position: "relative", height: "100vh" }}>
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}/>
        {/* Grid over canvas */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,162,39,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.015) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }}/>

        {/* 3 scene overlays */}
        {c.movie.map((sc, i) => (
          <div key={i} ref={[scene0Ref, scene1Ref, scene2Ref][i]} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px", pointerEvents: "none" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
              {SCENE_ACCENT.map((col, j) => <div key={j} style={{ width: j === i ? 28 : 6, height: 3, borderRadius: 2, background: j === i ? col : "rgba(255,255,255,0.12)", transition: "all 0.3s" }}/>)}
            </div>
            <h2 style={{ fontSize: "clamp(32px, 6vw, 68px)", fontWeight: 100, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.92)", marginBottom: 20, whiteSpace: "pre-line", lineHeight: 1.15 }}>{sc.title}</h2>
            <p style={{ fontSize: "clamp(14px, 1.6vw, 17px)", color: "rgba(255,255,255,0.5)", fontWeight: 200, maxWidth: 500, lineHeight: 1.85 }}>{sc.body}</p>
          </div>
        ))}

        {/* Progress dots */}
        <div style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 10 }}>
          {SCENE_ACCENT.map((col, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: col, opacity: 0.45 }}/>)}
        </div>
      </div>

      {/* ══ ANTI-LEAK ════════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section className="leak-section" style={{ padding: "120px 24px", maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        <div className="leak-visual" style={{ aspectRatio: "1", borderRadius: 16, border: "1px solid rgba(201,162,39,0.14)", background: "linear-gradient(145deg, rgba(201,162,39,0.06) 0%, rgba(139,92,246,0.05) 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
          {/* Scanlines */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(201,162,39,0.025) 3px, rgba(201,162,39,0.025) 4px)", pointerEvents: "none" }}/>
          {/* Corner accents */}
          {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i) => (
            <div key={i} style={{ position: "absolute", ...pos, width: 28, height: 28, borderTop: i<2 ? "1px solid rgba(201,162,39,0.7)" : "none", borderBottom: i>=2 ? "1px solid rgba(201,162,39,0.7)" : "none", borderLeft: i%2===0 ? "1px solid rgba(201,162,39,0.7)" : "none", borderRight: i%2===1 ? "1px solid rgba(201,162,39,0.7)" : "none" }}/>
          ))}
          <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(201,162,39,0.6)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
            <p style={{ marginTop: 12, fontSize: 9, letterSpacing: "0.4em", color: "rgba(201,162,39,0.45)", textTransform: "uppercase" }}>LSB · Steganography</p>
          </div>
        </div>
        <div className="leak-text">
          <p style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", marginBottom: 20, fontWeight: 300, fontStyle: "italic" }}>{c.leak.eyebrow}</p>
          <h2 style={{ fontSize: "clamp(26px, 3.5vw, 48px)", fontWeight: 100, lineHeight: 1.25, color: "rgba(255,255,255,0.9)", marginBottom: 28, whiteSpace: "pre-line", letterSpacing: "-0.02em" }}>{c.leak.h2}</h2>
          <p style={{ fontSize: 15, color: "rgba(170,170,170,0.7)", lineHeight: 1.9, fontWeight: 300, maxWidth: 440 }}>{c.leak.body}</p>
        </div>
      </section>

      {/* ══ KYC ═══════════════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section className="kyc-section" style={{ padding: "120px 24px", maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", marginBottom: 20, fontWeight: 300 }}>Verificación real</p>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 56px)", fontWeight: 100, color: "rgba(255,255,255,0.88)", marginBottom: 12, letterSpacing: "-0.02em" }}>{c.kyc.h1}</h2>
        <h2 style={{ fontSize: "clamp(28px, 4vw, 56px)", fontWeight: 100, marginBottom: 64, letterSpacing: "-0.02em", background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.kyc.h2}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {c.kyc.cards.map((item, i) => (
            <div key={i} className="kyc-card" style={{ padding: "36px 28px", border: "1px solid rgba(201,162,39,0.1)", borderRadius: 12, background: "linear-gradient(145deg, rgba(201,162,39,0.04), transparent)", cursor: "default", willChange: "transform" }}>
              <div style={{ fontSize: 36, marginBottom: 20 }}>{item.icon}</div>
              <h3 style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", marginBottom: 12, fontWeight: 300 }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: "rgba(150,150,150,0.7)", lineHeight: 1.8, fontWeight: 300 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES HORIZONTAL ═══════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <div style={{ padding: "60px 24px 24px", textAlign: "center" }}>
        <p className="feat-eyebrow" style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", fontWeight: 300 }}>La plataforma</p>
        <h2 style={{ fontSize: "clamp(26px, 3.5vw, 48px)", fontWeight: 100, letterSpacing: "-0.02em", color: "rgba(255,255,255,0.88)", marginTop: 12, marginBottom: 0 }}>Una red social completa. Nadie miente.</h2>
      </div>
      <div ref={featRef} style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
        <div ref={featTrackRef} style={{ display: "flex", alignItems: "center", height: "100%", paddingLeft: 60, paddingRight: 60, gap: 24, willChange: "transform" }}>
          {c.features.map((f, i) => (
            <div key={i} className="feat-card" style={{ flexShrink: 0, width: 300, height: 380, padding: "36px 28px", border: "1px solid rgba(201,162,39,0.1)", borderRadius: 14, background: "linear-gradient(145deg, rgba(201,162,39,0.05) 0%, rgba(139,92,246,0.03) 100%)", display: "flex", flexDirection: "column", justifyContent: "space-between", willChange: "transform" }}>
              <div>
                <span style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(201,162,39,0.4)", fontWeight: 300 }}>{f.n}</span>
                <div style={{ width: 28, height: 1, background: GOLD, margin: "14px 0 18px" }}/>
                <h3 style={{ fontSize: 18, fontWeight: 200, color: "rgba(255,255,255,0.88)", letterSpacing: "-0.01em", marginBottom: 14 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "rgba(150,150,150,0.7)", lineHeight: 1.8, fontWeight: 300 }}>{f.body}</p>
              </div>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD }}/>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", right: 28, bottom: 28, fontSize: 9, letterSpacing: "0.3em", color: "rgba(201,162,39,0.35)", textTransform: "uppercase" }}>scroll →</div>
      </div>

      {/* ══ STATS ════════════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section className="stats-section" style={{ padding: "120px 24px", maxWidth: 840, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40, textAlign: "center" }}>
          {c.stats.map((s, i) => (
            <div key={i} className="stat-item">
              <div style={{ fontSize: "clamp(52px, 9vw, 100px)", fontWeight: 100, letterSpacing: "-0.03em", background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
                <Counter target={s.value} suffix={s.suffix}/>
              </div>
              <div style={{ width: 24, height: 1, background: "rgba(201,162,39,0.35)", margin: "14px auto" }}/>
              <p style={{ fontSize: 10, letterSpacing: "0.22em", color: "rgba(201,162,39,0.6)", textTransform: "uppercase", fontWeight: 300 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ CTA ══════════════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section className="cta-section" style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(201,162,39,0.07), transparent)", pointerEvents: "none" }}/>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,162,39,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.022) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }}/>
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <p className="cta-item" style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", fontWeight: 300 }}>{c.pricing.eyebrow}</p>
          <h2 className="cta-item" style={{ fontSize: "clamp(36px, 7vw, 86px)", fontWeight: 100, letterSpacing: "-0.03em", background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "pre-line", lineHeight: 1.1 }}>{c.pricing.h2}</h2>
          <p className="cta-item" style={{ fontSize: 15, color: "rgba(155,155,155,0.65)", fontWeight: 300, maxWidth: 420, lineHeight: 1.85 }}>{c.pricing.body}</p>
          <Link ref={ctaBottom} to="/registro" className="glow-cta cta-item" style={{ padding: "18px 60px", background: GOLD, color: "#000", fontWeight: 400, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", borderRadius: 3, textDecoration: "none", marginTop: 8 }}>{c.pricing.cta}</Link>
          <p className="cta-item" style={{ fontSize: 9, letterSpacing: "0.22em", color: "rgba(201,162,39,0.38)", textTransform: "uppercase", fontWeight: 300 }}>{c.pricing.note}</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(201,162,39,0.1)", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <img src="/brand/logo-transparent.png" alt="AURA" style={{ width: 34, height: 34, objectFit: "contain", mixBlendMode: "screen", filter: "drop-shadow(0 0 6px rgba(201,162,39,0.4))" }}/>
        <p style={{ fontSize: 9, letterSpacing: "0.3em", color: "rgba(201,162,39,0.45)", textTransform: "uppercase", fontWeight: 300 }}>{c.footer.tagline}</p>
        <div style={{ display: "flex", gap: 28 }}>
          {c.footer.links.map(([label, href]) =>
            String(href).startsWith("mailto")
              ? <a key={label} href={String(href)} style={{ fontSize: 9, letterSpacing: "0.22em", color: "rgba(110,110,110,0.6)", textTransform: "uppercase", fontWeight: 300 }}>{label}</a>
              : <Link key={label} to={String(href)} style={{ fontSize: 9, letterSpacing: "0.22em", color: "rgba(110,110,110,0.6)", textTransform: "uppercase", fontWeight: 300 }}>{label}</Link>
          )}
        </div>
        <div style={{ width: "100%", maxWidth: 400, height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.1), transparent)" }}/>
        <p style={{ fontSize: 8, letterSpacing: "0.2em", color: "rgba(50,50,50,0.9)", fontWeight: 300 }}>&copy; {new Date().getFullYear()} AURA · EXCLUSIVE LIFESTYLE</p>
      </footer>

      <style>{`@keyframes aura-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }`}</style>
    </div>
  );
}
