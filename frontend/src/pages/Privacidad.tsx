import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function Privacidad() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen" style={{ background: "var(--obsidian)", color: "var(--paper)" }}>
      <header className="sticky top-0 z-20 backdrop-blur-md px-6 pt-safe-3 pb-4"
        style={{ background: "rgba(2,2,7,0.92)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft size={17} style={{ color: "var(--gold-deep)" }} strokeWidth={1.5}/>
          </button>
          <p className="brand-eyebrow">Política de Privacidad</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-4 text-center flex flex-col items-center">
          <Logo variant="soft" size={56}/>
          <p className="brand-eyebrow-muted">AURA · Exclusive Lifestyle</p>
          <h1 className="brand-title" style={{ fontSize: "var(--fs-display-l)" }}>Política de Privacidad</h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-dim)", letterSpacing: "0.14em" }}>Última actualización: 2026</p>
        </div>

        {[
          { title: "1. Información que recopilamos", body: `Al registrarte en AURA recopilamos los datos necesarios para verificar tu identidad y brindarte el servicio: nombre, apellido, fecha de nacimiento, correo electrónico, y documentación de identidad para el proceso de verificación. También recopilamos información de uso de la plataforma, como interacciones, mensajes y contenido publicado.` },
          { title: "2. Uso de la información", body: `Utilizamos tu información exclusivamente para: verificar tu identidad, personalizar tu experiencia, conectarte con otros miembros verificados, mejorar el servicio, y cumplir con obligaciones legales. No vendemos ni compartimos tu información personal con terceros salvo requerimiento legal expreso.` },
          { title: "3. Protección del contenido", body: `Todo el contenido multimedia publicado en AURA recibe una marca de agua digital invisible (esteganografía) con tu identificador de usuario. Esto permite rastrear distribuciones no autorizadas. Las imágenes no pueden descargarse ni redistribuirse desde la plataforma. La detección de capturas de pantalla es activa en todos los dispositivos compatibles.` },
          { title: "4. Mensajería privada", body: `Los mensajes entre usuarios se almacenan de forma cifrada. Podés configurar la eliminación automática de mensajes (15, 30 o 90 días) desde la configuración de cada conversación. El modo anónimo (disponible con membresía activa) te permite visitar perfiles sin dejar registro de visita.` },
          { title: "5. Cookies y seguimiento", body: `Utilizamos cookies técnicas necesarias para el funcionamiento de la plataforma. No utilizamos cookies de seguimiento de terceros ni publicidad conductual. La información de geolocalización (cuando la autorizás) se usa únicamente para mostrarte perfiles cercanos y nunca se comparte con terceros.` },
          { title: "6. Retención de datos", body: `Conservamos tu información mientras tu cuenta esté activa. Al eliminar tu cuenta, tu información personal y contenido publicado se eliminan de forma permanente dentro de los 30 días. Los mensajes de conversaciones pueden ser eliminados por vos en cualquier momento desde la configuración del chat.` },
          { title: "7. Tus derechos", body: `Tenés derecho a acceder, corregir o eliminar tu información personal en cualquier momento. Para ejercer estos derechos o hacer consultas sobre privacidad, escribinos a soporte@aurasw.club.` },
          { title: "8. Seguridad", body: `Implementamos medidas de seguridad técnicas y organizativas para proteger tu información: cifrado en tránsito (HTTPS/TLS), hash seguro de contraseñas (bcrypt), acceso restringido a datos sensibles, y auditoría de acciones administrativas. Verificamos la identidad de todos los miembros antes de permitir el acceso completo.` },
          { title: "9. Cambios a esta política", body: `Podemos actualizar esta política periódicamente. Te notificaremos por correo electrónico ante cambios significativos. El uso continuado de la plataforma tras los cambios implica aceptación de la nueva política.` },
          { title: "10. Contacto", body: `Para consultas sobre esta política de privacidad: soporte@aurasw.club` },
        ].map(({ title, body }) => (
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
  );
}
