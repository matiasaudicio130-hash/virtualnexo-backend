import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Privacidad() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#020207] text-white">
      <header className="sticky top-0 z-20 bg-[#020207]/90 backdrop-blur-md border-b border-amber-900/20 px-6 pt-safe-3 pb-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
            <ArrowLeft size={17} className="text-amber-700"/>
          </button>
          <h1 className="text-sm font-light tracking-[.2em] text-amber-400/80 uppercase">Política de Privacidad</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-2">
          <p className="text-[10px] tracking-[.4em] text-amber-800 uppercase">AURA — Exclusive Lifestyle</p>
          <h2 className="text-2xl font-thin text-white/90">Política de Privacidad</h2>
          <p className="text-xs text-stone-600">Última actualización: 2026</p>
        </div>

        {[
          {
            title: "1. Información que recopilamos",
            body: `Al registrarte en AURA recopilamos los datos necesarios para verificar tu identidad y brindarte el servicio: nombre, apellido, fecha de nacimiento, correo electrónico, y documentación de identidad para el proceso de verificación. También recopilamos información de uso de la plataforma, como interacciones, mensajes y contenido publicado.`,
          },
          {
            title: "2. Uso de la información",
            body: `Utilizamos tu información exclusivamente para: verificar tu identidad, personalizar tu experiencia, conectarte con otros miembros verificados, mejorar el servicio, y cumplir con obligaciones legales. No vendemos ni compartimos tu información personal con terceros salvo requerimiento legal expreso.`,
          },
          {
            title: "3. Protección del contenido",
            body: `Todo el contenido multimedia publicado en AURA recibe una marca de agua digital invisible (esteganografía) con tu identificador de usuario. Esto permite rastrear distribuciones no autorizadas. Las imágenes no pueden descargarse ni redistribuirse desde la plataforma. La detección de capturas de pantalla es activa en todos los dispositivos compatibles.`,
          },
          {
            title: "4. Mensajería privada",
            body: `Los mensajes entre usuarios se almacenan de forma cifrada. Podés configurar la eliminación automática de mensajes (15, 30 o 90 días) desde la configuración de cada conversación. El modo anónimo (disponible con membresía activa) te permite visitar perfiles sin dejar registro de visita.`,
          },
          {
            title: "5. Cookies y seguimiento",
            body: `Utilizamos cookies técnicas necesarias para el funcionamiento de la plataforma. No utilizamos cookies de seguimiento de terceros ni publicidad conductual. La información de geolocalización (cuando la autorizás) se usa únicamente para mostrarte perfiles cercanos y nunca se comparte con terceros.`,
          },
          {
            title: "6. Retención de datos",
            body: `Conservamos tu información mientras tu cuenta esté activa. Al eliminar tu cuenta, tu información personal y contenido publicado se eliminan de forma permanente dentro de los 30 días. Los mensajes de conversaciones pueden ser eliminados por vos en cualquier momento desde la configuración del chat.`,
          },
          {
            title: "7. Tus derechos",
            body: `Tenés derecho a acceder, corregir o eliminar tu información personal en cualquier momento. Para ejercer estos derechos o hacer consultas sobre privacidad, escribinos a soporte@aurasw.club.`,
          },
          {
            title: "8. Seguridad",
            body: `Implementamos medidas de seguridad técnicas y organizativas para proteger tu información: cifrado en tránsito (HTTPS/TLS), hash seguro de contraseñas (bcrypt), acceso restringido a datos sensibles, y auditoría de acciones administrativas. Verificamos la identidad de todos los miembros antes de permitir el acceso completo.`,
          },
          {
            title: "9. Cambios a esta política",
            body: `Podemos actualizar esta política periódicamente. Te notificaremos por correo electrónico ante cambios significativos. El uso continuado de la plataforma tras los cambios implica aceptación de la nueva política.`,
          },
          {
            title: "10. Contacto",
            body: `Para consultas sobre esta política de privacidad: soporte@aurasw.club`,
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
