import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGeolocation } from "@/hooks/useGeolocation";
import { NearbyUsers } from "@/components/NearbyUsers";
import { ProfileSuggestions } from "@/components/ProfileSuggestions";
import { BottomNav } from "@/components/BottomNav";
import { useAuthStore } from "@/store/authStore";
import { Compass, CalendarBlank, Airplane } from "@phosphor-icons/react";

type Tab = "personas" | "eventos" | "viaje";

export default function Explore() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { coords } = useGeolocation();
  const [tab, setTab] = useState<Tab>("personas");

  if (!user) return null;

  const tabs: { id: Tab; label: string; Icon: any }[] = [
    { id: "personas", label: "Personas",  Icon: Compass       },
    { id: "eventos",  label: "Eventos",   Icon: CalendarBlank },
    { id: "viaje",    label: "Modo Viaje", Icon: Airplane      },
  ];

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3">
        <h1
          className="text-sm tracking-[0.2em] uppercase"
          style={{ color: "var(--gold, #C9A227)", fontFamily: "var(--font-display, 'Cormorant Garamond', serif)" }}
        >
          Explorar
        </h1>
      </header>

      {/* Tab chips */}
      <div className="flex gap-2 px-4 pt-4 pb-2">
        {tabs.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                active
                  ? "border-transparent text-[#0a0a0f]"
                  : "border-border text-text-muted hover:border-border/80 bg-transparent"
              }`}
              style={active ? { background: "var(--gold, #C9A227)", color: "#0a0a0f" } : {}}
            >
              <Icon size={13} weight={active ? "fill" : "light"} />
              {label}
            </button>
          );
        })}
      </div>

      <main className="max-w-lg mx-auto pb-[80px]">
        {tab === "personas" && (
          <>
            {coords && <NearbyUsers lat={coords.lat} lng={coords.lng} />}
            <ProfileSuggestions />
          </>
        )}

        {tab === "eventos" && (
          <EventosTab navigate={navigate} />
        )}

        {tab === "viaje" && (
          <ViajeTab navigate={navigate} />
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function EventosTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="px-4 pt-6 flex flex-col items-center gap-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)" }}
      >
        <CalendarBlank size={28} weight="light" style={{ color: "var(--gold, #C9A227)" }} />
      </div>
      <div>
        <p className="font-semibold text-sm mb-1">Eventos de la comunidad</p>
        <p className="text-text-muted text-xs">Encontrá encuentros, fiestas y citas cercanas a vos.</p>
      </div>
      <button
        onClick={() => navigate("/events")}
        className="px-5 py-2.5 rounded-full text-xs font-medium transition-all hover:opacity-90"
        style={{ background: "var(--gold, #C9A227)", color: "#0a0a0f" }}
      >
        Ver eventos
      </button>
    </div>
  );
}

function ViajeTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="px-4 pt-6 flex flex-col items-center gap-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)" }}
      >
        <Airplane size={28} weight="light" style={{ color: "var(--gold, #C9A227)" }} />
      </div>
      <div>
        <p className="font-semibold text-sm mb-1">Modo Viaje</p>
        <p className="text-text-muted text-xs">Activá el modo viaje para aparecer en otra ciudad mientras estás de paso.</p>
      </div>
      <button
        onClick={() => navigate("/travel")}
        className="px-5 py-2.5 rounded-full text-xs font-medium transition-all hover:opacity-90"
        style={{ background: "var(--gold, #C9A227)", color: "#0a0a0f" }}
      >
        Activar modo viaje
      </button>
    </div>
  );
}
