import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "@/components/brand/Logo";
import { SEOHead } from "@/components/SEOHead";

const SECTIONS = [
  { title: "1. Aceptación de los términos", body: `Al registrarte y utilizar AURA aceptás estos términos en su totalidad. Si no estás de acuerdo con alguno de estos términos, no podés usar la plataforma. AURA es un servicio exclusivo para adultos mayores de 18 años. Al registrarte declarás bajo declaración jurada que tenés 18 años o más.` },
  { title: "2. Verificación de identidad", body: `El acceso completo a AURA requiere verificación de identidad. El proceso de verificación puede incluir validación de DNI, biometría facial y revisión manual por parte del equipo. AURA se reserva el derecho de rechazar solicitudes de membresía sin expresar motivos. La información de verificación se trata con estricta confidencialidad.` },
  { title: "3. Uso aceptable", body: `Al usar AURA te comprometés a: no publicar contenido que involucre menores de edad bajo ninguna circunstancia, no hostigar ni amenazar a otros miembros, no publicar contenido de terceros sin su consentimiento explícito, no compartir información personal de otros miembros fuera de la plataforma, y no usar la plataforma para actividades ilegales.` },
  { title: "4. Contenido y propiedad intelectual", body: `El contenido que publicás en AURA (fotos, videos, textos) sigue siendo de tu propiedad. Al publicarlo otorgás a AURA una licencia no exclusiva para mostrarlo dentro de la plataforma. AURA aplica marcas de agua digitales a todo el contenido multimedia para rastrear distribuciones no autorizadas. La distribución de contenido de otros miembros fuera de la plataforma está estrictamente prohibida y puede resultar en acciones legales.` },
  { title: "5. Membresía y pagos", body: `El acceso completo a AURA requiere una membresía de pago. Los planes disponibles se muestran en la sección de precios. Los pagos son procesados de forma segura. Las membresías no son reembolsables salvo en casos de error de facturación comprobable. AURA se reserva el derecho de modificar los precios con previo aviso de 30 días.` },
  { title: "6. Suspensión y cancelación", body: `AURA puede suspender o cancelar tu cuenta sin previo aviso si: violás estos términos, publicás contenido ilegal o dañino, te comportás de forma hostil o abusiva con otros miembros, o proporcionás información falsa en el proceso de verificación. Podés cancelar tu cuenta en cualquier momento desde la configuración.` },
  { title: "7. Limitación de responsabilidad", body: `AURA es una plataforma de conexión entre adultos verificados. No somos responsables por las interacciones entre miembros fuera de la plataforma, por el contenido publicado por los usuarios, ni por decisiones tomadas en base a la información de los perfiles. El uso de la plataforma es bajo tu propia responsabilidad.` },
  { title: "8. Privacidad", body: `El tratamiento de tu información personal se rige por nuestra Política de Privacidad, disponible en aurasw.club/privacidad. Al aceptar estos términos también aceptás nuestra política de privacidad.` },
  { title: "9. Modificaciones", body: `Podemos modificar estos términos en cualquier momento. Te notificaremos por correo electrónico ante cambios significativos con al menos 15 días de anticipación. El uso continuado de la plataforma tras los cambios implica la aceptación de los nuevos términos.` },
  { title: "10. Jurisdicción", body: `Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa se someterá a la jurisdicción de los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.` },
  { title: "11. Contacto", body: `Para consultas sobre estos términos: soporte@aurasw.club` },
];

export default function Terminos() {
  const navigate = useNavigate();
  return (
    <>
    <SEOHead
      title="Términos y Condiciones | AURA — Comunidad Adulta Verificada Argentina"
      description="Términos de uso de AURA: plataforma adulta +18 con verificación de identidad. Uso aceptable, privacidad de contenido, membresías y normas de la comunidad lifestyle."
      canonical="https://aurasw.club/terminos"
    />
    <div className="min-h-screen" style={{ background: "var(--obsidian)", color: "var(--paper)" }}>
      <header className="sticky top-0 z-20 backdrop-blur-md px-6 pt-safe-3 pb-4"
        style={{ background: "rgba(2,2,7,0.92)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft size={17} style={{ color: "var(--gold-deep)" }} strokeWidth={1.5}/>
          </button>
          <p className="brand-eyebrow">Términos y Condiciones</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-4 text-center flex flex-col items-center">
          <Logo variant="soft" size={56}/>
          <p className="brand-eyebrow-muted">AURA · Exclusive Lifestyle</p>
          <h1 className="brand-title" style={{ fontSize: "var(--fs-display-l)" }}>Términos y Condiciones</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.14em" }}>Última actualización: 2026</p>
        </div>

        {SECTIONS.map(({ title, body }) => (
          <section key={title} style={{ borderBottom: "1px solid var(--border-soft)", paddingBottom: 24 }}>
            <h3 className="brand-eyebrow" style={{ marginBottom: 12 }}>{title}</h3>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--mist)", lineHeight: 1.75 }}>{body}</p>
          </section>
        ))}

        <div style={{ paddingTop: 24, textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-dim)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            © 2026 AURA · EXCLUSIVE LIFESTYLE · aurasw.club
          </p>
        </div>
      </main>
    </div>
    </>
  );
}
