import { useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Logo, Wordmark } from "@/components/brand/Logo";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* ── Copy ──────────────────────────────────────────────────── */
const COPY = {
  es: {
    toggle: "EN",
    nav: { login: "Ingresar", join: "Pedí tu invitación" },
    hero: {
      tag: "La comunidad lifestyle adulta verificada de Argentina.",
      line1: "Solo los reales.",
      sub: "Acá todos son quienes dicen ser. Y todo lo que compartís tiene firma.",
      cta: "Pedí tu invitación",
      ctaSub: "Ya soy parte",
    },
    how: {
      eyebrow: "Cómo funciona",
      h2: "Tres pasos. Una comunidad diferente.",
      steps: [
        { n: "01", title: "Pedís tu invitación", body: "Registrarte toma menos de dos minutos. El acceso es por invitación — cada perfil que ves adentro pasó exactamente lo mismo." },
        { n: "02", title: "Verificás tu identidad", body: "DNI real y biometría facial. No alcanza con una selfie. El proceso es privado, seguro y dura menos de cinco minutos." },
        { n: "03", title: "Entrás a la comunidad", body: "Feed, mensajes, eventos, grupos, álbumes privados. Todo con personas verificadas. Nadie es anónimo. Nadie puede mentir." },
      ],
    },
    leak: {
      eyebrow: "Tu firma. En cada foto.",
      h2: "Si tu foto se filtra, sabemos exactamente de dónde salió.",
      body: "Esteganografía: una firma digital invisible se inscribe en cada foto que compartís. No se ve, no se borra, y sobrevive incluso si alguien la captura con otra cámara. El que filtra, queda expuesto.",
    },
    kyc: {
      h1: "Acá no entra cualquiera.",
      h2: "Y eso lo cambia absolutamente todo.",
      cards: [
        { icon: "👤", title: "DNI real", body: "Documento de identidad verificado. No alcanza con una selfie." },
        { icon: "🔬", title: "Biometría facial", body: "Tu cara, confirmada en tiempo real. Sin fotos viejas, sin trucos." },
        { icon: "✓",  title: "Aprobación humana", body: "Revisión manual antes de activar tu perfil. Cero atajos." },
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
    cta: {
      eyebrow: "Acceso",
      h2: "Si llegaste hasta acá,\nya sabés que querés entrar.",
      body: "El proceso de verificación es privado, seguro y toma menos de 5 minutos. Lo que viene después, vale cada segundo.",
      btn: "Pedí tu invitación",
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
      line1: "Only the real ones.",
      sub: "Everyone here is who they say they are. And everything you share has a signature.",
      cta: "Request your invite",
      ctaSub: "I'm already in",
    },
    how: {
      eyebrow: "How it works",
      h2: "Three steps. A different community.",
      steps: [
        { n: "01", title: "Request your invite", body: "Signing up takes less than two minutes. Access is by invitation — every profile you see inside went through exactly the same process." },
        { n: "02", title: "Verify your identity", body: "Real ID and facial biometrics. A selfie is not enough. The process is private, secure and takes less than five minutes." },
        { n: "03", title: "Join the community", body: "Feed, messages, events, groups, private albums. All with verified people. No one is anonymous. No one can lie." },
      ],
    },
    leak: {
      eyebrow: "Your signature. In every photo.",
      h2: "If your photo leaks, we know exactly where it came from.",
      body: "Steganography: an invisible digital signature is written into every photo you share. It can't be seen, can't be removed, and survives even if captured by another camera. The leaker gets exposed.",
    },
    kyc: {
      h1: "Not everyone gets in.",
      h2: "And that changes absolutely everything.",
      cards: [
        { icon: "👤", title: "Real ID", body: "Government-issued identity document verified. A selfie is not enough." },
        { icon: "🔬", title: "Facial biometrics", body: "Your face, confirmed in real time. No old photos, no tricks." },
        { icon: "✓",  title: "Human approval", body: "Manual review before your profile is activated. Zero shortcuts." },
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
    cta: {
      eyebrow: "Access",
      h2: "If you made it this far,\nyou already know you want in.",
      body: "The verification process is private, secure and takes less than 5 minutes. What comes after is worth every second.",
      btn: "Request your invite",
      note: "Verification required · 18+ only · Argentina",
    },
    footer: {
      tagline: "Argentina's verified adult community.",
      links: [["Privacy", "/privacidad"], ["Terms", "/terminos"], ["Contact", "mailto:soporte@aurasw.club"]],
    },
  },
} as const;

const GOLD = "linear-gradient(135deg,#C9A227 0%,#FFE566 50%,#A07818 100%)";

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

  const cta1      = useMagnet(0.38);
  const cta2      = useMagnet(0.25);
  const ctaBottom = useMagnet(0.35);

  useGSAP(() => {
    /* ── Hero entrance ──────────────────────────────────── */
    gsap.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(".h-logo", { scale: 0.5, opacity: 0, filter: "blur(30px)" }, { scale: 1, opacity: 1, filter: "blur(0px)", duration: 2 })
      .fromTo(".h-tag",  { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.9")
      .fromTo(".h-line", { y: 80, opacity: 0, skewY: 4 }, { y: 0, opacity: 1, skewY: 0, duration: 1 }, "-=0.5")
      .fromTo(".h-sub",  { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, "-=0.5")
      .fromTo(".h-ctas", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.4");

    gsap.to(".h-logo", { y: -12, duration: 5, ease: "sine.inOut", repeat: -1, yoyo: true });
    gsap.to(".h-logo", { y: -80, ease: "none", scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 2 } });
    gsap.to(".glow-cta", { boxShadow: "0 0 40px rgba(201,162,39,0.55)", duration: 2, repeat: -1, yoyo: true, ease: "sine.inOut" });
    gsap.to(".logo-ring", { scale: 1.08, opacity: 0.4, duration: 2, ease: "sine.inOut", repeat: -1, yoyo: true });

    /* ── Glitch ───────────────────────────────────────── */
    const fireGlitch = () => {
      const tl = gsap.timeline({ onComplete: () => gsap.delayedCall(3 + Math.random() * 5, fireGlitch) });
      tl.set(".glitch-r", { x: -4, opacity: 0.6 })
        .set(".glitch-c", { x: 4, opacity: 0.5 })
        .to([".glitch-r", ".glitch-c"], { opacity: 0, duration: 0.08 })
        .set(".glitch-r", { x: 3, opacity: 0.5 })
        .set(".glitch-c", { x: -3, opacity: 0.4 })
        .to([".glitch-r", ".glitch-c"], { opacity: 0, duration: 0.06 })
        .set(".glitch-r", { x: -6, y: 2, opacity: 0.7 })
        .to([".glitch-r", ".glitch-c"], { opacity: 0, x: 0, y: 0, duration: 0.1 });
    };
    gsap.delayedCall(2.5, fireGlitch);

    /* ── Section reveals ────────────────────────────── */
    gsap.utils.toArray<HTMLElement>(".reveal-up").forEach(el =>
      gsap.fromTo(el,
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 82%", once: true } }
      )
    );
    gsap.utils.toArray<HTMLElement>(".reveal-stagger").forEach(container =>
      gsap.fromTo(container.querySelectorAll(".stagger-child"),
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.13, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: container, start: "top 78%", once: true } }
      )
    );

    /* ── Leak visual reveal ─────────────────────────── */
    gsap.fromTo(".leak-visual",
      { clipPath: "inset(100% 0% 0% 0%)" },
      { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "power4.out",
        scrollTrigger: { trigger: ".leak-visual", start: "top 80%", once: true } }
    );

    /* ── KYC cards ──────────────────────────────────── */
    gsap.fromTo(".kyc-card",
      { y: 70, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.14, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: ".kyc-section", start: "top 72%", once: true } }
    );
    gsap.utils.toArray<HTMLElement>(".kyc-card").forEach(card => {
      card.addEventListener("mousemove", (e: MouseEvent) => {
        const b = card.getBoundingClientRect();
        gsap.to(card, { rotateX: ((e.clientY-b.top)/b.height-0.5)*-18, rotateY: ((e.clientX-b.left)/b.width-0.5)*18, duration: 0.4, ease: "power2.out", transformPerspective: 900 });
      });
      card.addEventListener("mouseleave", () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "elastic.out(1,0.4)" }));
    });

    /* ── Stats ──────────────────────────────────────── */
    gsap.fromTo(".stat-item",
      { y: 50, opacity: 0, scale: 0.88 },
      { y: 0, opacity: 1, scale: 1, stagger: 0.2, duration: 1, ease: "back.out(1.5)",
        scrollTrigger: { trigger: ".stats-section", start: "top 75%", once: true } }
    );

    /* ── Dividers ───────────────────────────────────── */
    gsap.utils.toArray<HTMLElement>(".s-div").forEach(el =>
      gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "power2.inOut", scrollTrigger: { trigger: el, start: "top 92%", once: true } })
    );
  }, []);

  return (
    <div style={{ background: "var(--obsidian)", color: "var(--paper)", overflowX: "hidden", fontFamily: "var(--font-sans)" }}>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", background: "linear-gradient(to bottom,rgba(2,2,7,.95),transparent)" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Logo variant="primary" size={28} />
          <Wordmark size={11} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setLang(l => l === "es" ? "en" : "es")} style={{ fontSize: 9, letterSpacing: "0.35em", color: "rgba(201,162,39,0.65)", border: "1px solid rgba(201,162,39,0.25)", padding: "5px 12px", borderRadius: 3, background: "transparent", cursor: "pointer" }}>{c.toggle}</button>
          <Link to="/login" style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(200,200,200,0.6)", textDecoration: "none", display: "none" }} className="sm:block">{c.nav.login}</Link>
          <Link to="/registro" style={{ fontSize: 10, letterSpacing: "0.2em", padding: "7px 16px", border: "1px solid rgba(201,162,39,0.4)", color: "rgba(201,162,39,0.9)", borderRadius: 3, textDecoration: "none", fontWeight: 300 }}>{c.nav.join}</Link>
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════ */}
      <section className="hero-section" style={{ position: "relative", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "80px 24px 60px", overflow: "hidden" }}>
        <video
          autoPlay muted loop playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, opacity: 0.65 }}
        >
          <source src="/brand/hero-bg.mp4" type="video/mp4"/>
        </video>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(2,2,7,0.55) 0%, rgba(2,2,7,0.3) 50%, rgba(2,2,7,0.85) 100%)", zIndex: 1 }}/>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 70% at 50% 40%, rgba(28,20,8,0.5) 0%, transparent 70%)", zIndex: 1 }}/>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,162,39,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.012) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none", zIndex: 2 }}/>
        <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: "radial-gradient(ellipse, rgba(201,162,39,0.08) 0%, transparent 65%)", pointerEvents: "none", zIndex: 2 }}/>

        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, maxWidth: 800 }}>
          <div className="h-logo" style={{ position: "relative", width: 120, height: 120 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px)", zIndex: 3, pointerEvents: "none" }}/>
            <div className="logo-ring" style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "1px solid rgba(201,162,39,0.2)", zIndex: 0 }}/>
            <div style={{ position: "absolute", inset: -24, borderRadius: "50%", border: "1px solid rgba(201,162,39,0.08)", zIndex: 0 }}/>
            <Logo variant="primary" size={120} style={{ position: "relative", zIndex: 2, filter: "drop-shadow(0 0 24px rgba(201,162,39,0.8)) drop-shadow(0 0 56px rgba(201,162,39,0.35)) brightness(1.15)" }}/>
            <img src="/brand/logo-aura.png" alt="" aria-hidden className="glitch-r" style={{ width: 120, height: 120, objectFit: "contain", position: "absolute", inset: 0, zIndex: 1, filter: "saturate(0) brightness(2)", opacity: 0, mixBlendMode: "screen" as const }}/>
            <img src="/brand/logo-aura.png" alt="" aria-hidden className="glitch-c" style={{ width: 120, height: 120, objectFit: "contain", position: "absolute", inset: 0, zIndex: 1, filter: "saturate(0) brightness(2)", opacity: 0, mixBlendMode: "screen" as const }}/>
          </div>

          <p className="h-tag" style={{ fontFamily: "var(--font-mono)", fontSize: "clamp(9px,1.2vw,11px)", letterSpacing: "0.28em", color: "var(--gold)", textTransform: "uppercase", fontWeight: 500 }}>{c.hero.tag}</p>

          <div style={{ overflow: "hidden" }}>
            <h1 className="h-line" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(48px,9vw,104px)", fontWeight: 300, fontStyle: "italic", lineHeight: 1.05, letterSpacing: "-0.03em", background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {c.hero.line1}
            </h1>
          </div>

          <p className="h-sub" style={{ fontSize: "clamp(15px,1.8vw,18px)", color: "var(--mist)", fontWeight: 300, lineHeight: 1.65, maxWidth: 480 }}>{c.hero.sub}</p>

          <div className="h-ctas" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <Link ref={cta1} to="/registro" className="glow-cta" style={{ padding: "15px 40px", background: GOLD, color: "#000", fontWeight: 400, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", borderRadius: 3, textDecoration: "none" }}>{c.hero.cta}</Link>
            <Link ref={cta2} to="/login" style={{ padding: "15px 40px", border: "1px solid rgba(201,162,39,0.35)", color: "rgba(201,162,39,0.85)", fontWeight: 300, fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", borderRadius: 3, textDecoration: "none" }}>{c.hero.ctaSub}</Link>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10 }}>
          <div style={{ width: 1, height: 48, background: "linear-gradient(to bottom, transparent, rgba(201,162,39,0.45))" }}/>
          <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(201,162,39,0.6)", animation: "aura-bounce 1.4s ease-in-out infinite" }}/>
        </div>
      </section>

      {/* ══ CÓMO FUNCIONA ═══════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section style={{ padding: "100px 24px", maxWidth: 1080, margin: "0 auto" }}>
        <div className="reveal-up" style={{ textAlign: "center", marginBottom: 64 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", fontWeight: 300, marginBottom: 16 }}>{c.how.eyebrow}</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,4vw,52px)", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--paper)" }}>{c.how.h2}</h2>
        </div>
        <div className="reveal-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 2 }}>
          {c.how.steps.map((step, i) => (
            <div key={i} className="stagger-child" style={{ padding: "48px 36px", background: i === 1 ? "rgba(201,162,39,0.04)" : "transparent", border: "1px solid rgba(201,162,39,0.08)", position: "relative", overflow: "hidden" }}>
              {/* Number watermark */}
              <div style={{ position: "absolute", top: -8, right: 20, fontFamily: "var(--font-display)", fontSize: 120, fontWeight: 100, color: "rgba(201,162,39,0.04)", lineHeight: 1, pointerEvents: "none", userSelect: "none" }}>{step.n}</div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.35em", color: "rgba(201,162,39,0.5)", display: "block", marginBottom: 20 }}>{step.n}</span>
              <div style={{ width: 32, height: 1, background: GOLD, marginBottom: 20 }}/>
              <h3 style={{ fontSize: "clamp(17px,2vw,21px)", fontWeight: 200, color: "var(--paper)", marginBottom: 16, letterSpacing: "-0.01em", lineHeight: 1.3 }}>{step.title}</h3>
              <p style={{ fontSize: 14, color: "var(--mist)", lineHeight: 1.85, fontWeight: 300 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ ANTI-LEAK ════════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section style={{ padding: "100px 24px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 64, alignItems: "center" }}>
          <div className="leak-visual" style={{ aspectRatio: "1", maxWidth: 480, width: "100%", borderRadius: 16, border: "1px solid rgba(201,162,39,0.14)", background: "linear-gradient(145deg, rgba(201,162,39,0.06) 0%, rgba(139,92,246,0.05) 100%)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(201,162,39,0.025) 3px, rgba(201,162,39,0.025) 4px)", pointerEvents: "none" }}/>
            {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i) => (
              <div key={i} style={{ position: "absolute", ...pos, width: 28, height: 28, borderTop: i<2 ? "1px solid rgba(201,162,39,0.7)" : "none", borderBottom: i>=2 ? "1px solid rgba(201,162,39,0.7)" : "none", borderLeft: i%2===0 ? "1px solid rgba(201,162,39,0.7)" : "none", borderRight: i%2===1 ? "1px solid rgba(201,162,39,0.7)" : "none" }}/>
            ))}
            <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(201,162,39,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
              <p style={{ marginTop: 12, fontSize: 9, letterSpacing: "0.4em", color: "rgba(201,162,39,0.45)", textTransform: "uppercase" }}>LSB · Steganography</p>
            </div>
          </div>
          <div className="reveal-up">
            <p style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", marginBottom: 20, fontWeight: 300, fontStyle: "italic" }}>{c.leak.eyebrow}</p>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,3.5vw,46px)", fontWeight: 400, lineHeight: 1.25, color: "var(--paper)", marginBottom: 28, letterSpacing: "-0.02em" }}>{c.leak.h2}</h2>
            <p style={{ fontSize: 15, color: "var(--silver)", lineHeight: 1.9, fontWeight: 300, maxWidth: 440 }}>{c.leak.body}</p>
          </div>
        </div>
      </section>

      {/* ══ KYC ═══════════════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section className="kyc-section" style={{ padding: "100px 24px", maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
        <div className="reveal-up" style={{ marginBottom: 60 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", marginBottom: 20, fontWeight: 300 }}>Verificación real</p>
          <h2 style={{ fontSize: "clamp(28px,4vw,52px)", fontWeight: 100, color: "var(--paper)", marginBottom: 12, letterSpacing: "-0.02em" }}>{c.kyc.h1}</h2>
          <h2 style={{ fontSize: "clamp(28px,4vw,52px)", fontWeight: 100, letterSpacing: "-0.02em", background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{c.kyc.h2}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
          {c.kyc.cards.map((item, i) => (
            <div key={i} className="kyc-card" style={{ padding: "36px 28px", border: "1px solid rgba(201,162,39,0.1)", borderRadius: 12, background: "linear-gradient(145deg, rgba(201,162,39,0.04), transparent)", cursor: "default", willChange: "transform" }}>
              <div style={{ fontSize: 36, marginBottom: 20 }}>{item.icon}</div>
              <h3 style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.85)", marginBottom: 12, fontWeight: 300 }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: "var(--mist)", lineHeight: 1.8, fontWeight: 300 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES GRID ════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section style={{ padding: "100px 24px", maxWidth: 1080, margin: "0 auto" }}>
        <div className="reveal-up" style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", fontWeight: 300, marginBottom: 16 }}>La plataforma</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px,3.5vw,46px)", fontWeight: 400, letterSpacing: "-0.02em", color: "var(--paper)" }}>Una red social completa. Nadie miente.</h2>
        </div>
        <div className="reveal-stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {c.features.map((f, i) => (
            <div key={i} className="stagger-child" style={{ padding: "32px 28px", border: "1px solid rgba(201,162,39,0.08)", borderRadius: 14, background: "linear-gradient(145deg, rgba(201,162,39,0.03) 0%, rgba(139,92,246,0.02) 100%)", display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.3em", color: "rgba(201,162,39,0.4)", fontWeight: 300 }}>{f.n}</span>
              <div style={{ width: 24, height: 1, background: GOLD }}/>
              <h3 style={{ fontSize: 16, fontWeight: 200, color: "var(--paper)", letterSpacing: "-0.01em" }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "var(--mist)", lineHeight: 1.8, fontWeight: 300 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ STATS ════════════════════════════════════════════ */}
      <div className="s-div" style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.22), transparent)", transformOrigin: "center" }}/>
      <section className="stats-section" style={{ padding: "100px 24px", maxWidth: 840, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 40, textAlign: "center" }}>
          {c.stats.map((s, i) => (
            <div key={i} className="stat-item">
              <div style={{ fontSize: "clamp(52px,9vw,96px)", fontWeight: 100, letterSpacing: "-0.03em", background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1 }}>
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
      <section style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "100px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(201,162,39,0.07), transparent)", pointerEvents: "none" }}/>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,162,39,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(201,162,39,0.022) 1px, transparent 1px)", backgroundSize: "64px 64px", pointerEvents: "none" }}/>
        <div className="reveal-stagger" style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <p className="stagger-child" style={{ fontSize: 9, letterSpacing: "0.44em", color: "rgba(201,162,39,0.55)", textTransform: "uppercase", fontWeight: 300 }}>{c.cta.eyebrow}</p>
          <h2 className="stagger-child" style={{ fontFamily: "var(--font-display)", fontSize: "clamp(36px,7vw,80px)", fontWeight: 300, fontStyle: "italic", letterSpacing: "-0.03em", background: GOLD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "pre-line", lineHeight: 1.1 }}>{c.cta.h2}</h2>
          <p className="stagger-child" style={{ fontSize: 15, color: "var(--mist)", fontWeight: 300, maxWidth: 420, lineHeight: 1.85 }}>{c.cta.body}</p>
          <Link ref={ctaBottom} to="/registro" className="glow-cta stagger-child" style={{ padding: "18px 60px", background: GOLD, color: "#000", fontWeight: 400, fontSize: 11, letterSpacing: "0.25em", textTransform: "uppercase", borderRadius: 3, textDecoration: "none", marginTop: 8 }}>{c.cta.btn}</Link>
          <p className="stagger-child" style={{ fontSize: 9, letterSpacing: "0.22em", color: "rgba(201,162,39,0.38)", textTransform: "uppercase", fontWeight: 300 }}>{c.cta.note}</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(201,162,39,0.1)", padding: "48px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <Logo variant="soft" size={40} />
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
