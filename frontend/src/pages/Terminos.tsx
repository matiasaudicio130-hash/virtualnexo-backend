import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Terminos() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#020207] text-white">
      <header className="sticky top-0 z-20 bg-[#020207]/90 backdrop-blur-md border-b border-amber-900/20 px-6 pt-safe-3 pb-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft size={17} className="text-amber-700"/>
          </button>
          <h1 className="text-sm font-light tracking-[.2em] text-amber-400/80 uppercase">Términos y Condiciones</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-2">
          <p className="text-[10px] tracking-[.4em] text-amber-800 uppercase">AURA — Exclusive Lifestyle</p>
          <h2 className="text-2xl font-thin text-white/90">Términos y Condiciones de Uso</h2>
          <p className="text-xs text-stone-600">Última actualización: 2026</p>
        </div>

        {[
          {
            title: "1. Aceptación de los términos",
            body: `Al registrarte y utilizar AURA aceptás estos términos en su totalidad. Si no estás de acuerdo con alguno de estos términos, no podés usar la plataforma. AURA es un servicio exclusivo para adultos mayores de 18 años. Al registrarte declarás bajo declaración jurada que tenés 18 años o más.`,
          },
          {
            title: "2. Verificación de identidad",
            body: `El acceso completo a AURA requiere verificación de identidad. El proceso de verificación puede incluir validación de DNI, biometría facial y revisión manual por parte del equipo. AURA se reserva el derecho de rechazar solicitudes de membresía sin expresar motivos. La información de verificación se trata con estricta confidencialidad.`,
          },
          {
            title: "3. Uso aceptable",
            body: `Al usar AURA te comprometés a: no publicar contenido que involucre menores de edad bajo ninguna circunstancia, no hostigar ni amenazar a otros miembros, no publicar contenido de terceros sin su consentimiento explícito, no compartir información personal de otros miembros fuera de la plataforma, y no usar la plataforma para actividades ilegales.`,
          },
          {
            title: "4. Contenido y propiedad intelectual",
            body: `El contenido que publicás en AURA (fotos, videos, textos) sigue siendo de tu propiedad. Al publicarlo otorgás a AURA una licencia no exclusiva para mostrarlo dentro de la plataforma. AURA aplica marcas de agua digitales a todo el contenido multimedia para rastrear distribuciones no autorizadas. La distribución de contenido de otros miembros fuera de la plataforma está estrictamente prohibida y puede resultar en acciones legales.`,
          },
          {
            title: "5. Membresía y pagos",
            body: `El acceso completo a AURA requiere una membresía de pago. Los planes disponibles se muestran en la sección de precios. Los pagos son procesados de forma segura. Las membresías no son reembolsables salvo en casos de error de facturación comprobable. AURA se reserva el derecho de modificar los precios con previo aviso de 30 días.`,
          },
          {
            title: "6. Suspensión y cancelación",
            body: `AURA puede suspender o cancelar tu cuenta sin previo aviso si: violás estos términos, publicás contenido ilegal o dañino, te comportás de forma hostil o abusiva con otros miembros, o proporcionás información falsa en el proceso de verificación. Podés cancelar tu cuenta en cualquier momento desde la configuración.`,
          },
          {
            title: "7. Limitación de responsabilidad",
            body: `AURA es una plataforma de conexión entre adultos verificados. No somos responsables por las interacciones entre miembros fuera de la plataforma, por el contenido publicado por los usuarios, ni por decisiones tomadas en base a la información de los perfiles. El uso de la plataforma es bajo tu propia responsabilidad.`,
          },
          {
            title: "8. Privacidad",
            body: `El tratamiento de tu información personal se rige por nuestra Política de Privacidad, disponible en aurasw.club/privacidad. Al aceptar estos términos también aceptás nuestra política de privacidad.`,
          },
          {
            title: "9. Modificaciones",
            body: `Podemos modificar estos términos en cualquier momento. Te notificaremos por correo electrónico ante cambios significativos con al menos 15 días de anticipación. El uso continuado de la plataforma tras los cambios implica la aceptación de los nuevos términos.`,
          },
          {
            title: "10. Jurisdicción",
            body: `Estos términos se rigen por las leyes de la República Argentina. Cualquier disputa se someterá a la jurisdicción de los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.`,
          },
          {
            title: "11. Contacto",
            body: `Para consultas sobre estos términos: soporte@aurasw.club`,
          },
        ].map(({ title, body }) => (
          <section key={title}>
            <h3 className="text-sm font-medium text-amber-500/80 mb-3 tracking-wide">{title}</h3>
            <p className="text-sm text-stone-500 leading-relaxed font-light">{body}</p>
          </section>
        ))}

        <div className="pt-8 border-t border-amber-900/20">
          <p className="text-[10px] text-stone-700 text-center tracking-[.2em]">
            © 2026 AURA · EXCLUSIVE LIFESTYLE · aurasw.club
          </p>
        </div>
      </main>
    </div>
  );
}
