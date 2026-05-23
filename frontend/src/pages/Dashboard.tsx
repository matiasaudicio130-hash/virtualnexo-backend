import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useAuth } from "@/hooks/useAuth";
import { useThemeStore } from "@/store/themeStore";
import { useLangStore } from "@/store/langStore";
import type { Theme } from "@/store/themeStore";
import type { Lang } from "@/i18n";
import { APP_CONFIG } from "@/config/app";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Shield, LogOut, User,
  Settings, Check, Eye, Heart,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { usePricingPlans, formatARS, formatUSD } from "@/hooks/useExchangeRate";
import { profilesApi } from "@/lib/api";
import { AvatarUpload } from "@/components/AvatarUpload";
import { StreakBadge } from "@/components/StreakBadge";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { ProfileTypeSettings } from "@/components/ProfileTypeSettings";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SecuritySettings } from "@/components/SecuritySettings";
import { EditProfileModal } from "@/components/EditProfileModal";
import { MyProfileSection } from "@/components/MyProfileSection";
import { NavLogo } from "@/components/AuraLogo";
import { StoryHighlights } from "@/components/StoryHighlights";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, EyeOff } from "lucide-react";
import { discoveryApi } from "@/lib/api";
import { PROFILE_TYPE_CONFIG, ORIENTATION_CONFIG } from "@/types";
import type { ProfileType, SexualOrientation } from "@/types";

const THEMES: { id: Theme; color: string; label_es: string; label_en: string }[] = [
  { id: "dark", color: "#8B5CF6", label_es: "Dark",       label_en: "Dark" },
  { id: "blue", color: "#3182F6", label_es: "Azul",       label_en: "Blue" },
  { id: "red",  color: "#D21932", label_es: "Rojo",       label_en: "Red"  },
  { id: "pure", color: "#D2D2D2", label_es: "Oscuro puro",label_en: "Pure dark" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { logout, refreshUser } = useAuth();
  const { theme, setTheme } = useThemeStore();
  const { lang, t, setLang } = useLangStore();
  const [settingsOpen, setSettingsOpen]   = useState(false);
  const [viewers, setViewers]             = useState<any[]>([]);
  const [showViewers, setShowViewers]     = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const push = usePushNotifications();
  const [anonMode, setAnonMode] = useState(false);

  useScreenCapture({ warn: true });

  useEffect(() => {
    refreshUser();
    profilesApi.viewers().then(r => setViewers(r.data)).catch(() => {});
  }, []);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  if (!user) return null;

  const profileCfg = user.profile_type ? PROFILE_TYPE_CONFIG[user.profile_type as ProfileType] : null;
  const orientCfg  = user.sexual_orientation && user.sexual_orientation !== "na"
    ? ORIENTATION_CONFIG[user.sexual_orientation as SexualOrientation]
    : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary animate-fade-in">
      <InstallPrompt />
      {showEditProfile && (
        <EditProfileModal
          onClose={() => setShowEditProfile(false)}
          onSaved={() => refreshUser()}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/85 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center justify-between">
        <NavLogo />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="p-2 rounded-xl hover:bg-bg-muted transition-colors"
            title={t.nav.settings}
          >
            <Settings size={17} className={`transition-colors ${settingsOpen ? "text-accent-purple" : "text-text-muted"}`} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-bg-muted transition-colors"
            title={t.common.logout}
          >
            <LogOut size={17} className="text-text-muted" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-5 pb-[80px]">

        {/* Panel de configuración */}
        {settingsOpen && (
          <Card className="p-5 border-accent-purple/20 animate-slide-up">
            <h3 className="text-sm font-semibold mb-4">{t.settings.title}</h3>

            <div className="space-y-5">
              {/* Modo anónimo */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-medium flex items-center gap-1.5">
                  <EyeOff size={11}/> Modo anónimo
                </p>
                {user.membership_type === "none" ? (
                  <p className="text-xs text-text-muted">Requiere membresía activa</p>
                ) : (
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-text-secondary">Visitar perfiles sin dejar rastro</span>
                    <button
                      onClick={async () => {
                        try {
                          const { data } = await discoveryApi.toggleAnonymous();
                          setAnonMode(data.anonymous_mode);
                        } catch { /* ignore */ }
                      }}
                      className={"relative w-10 h-5 rounded-full transition-colors " + (anonMode ? "bg-accent-purple" : "bg-bg-muted border border-border")}
                    >
                      <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform " + (anonMode ? "translate-x-5" : "translate-x-0.5")}/>
                    </button>
                  </label>
                )}
              </div>

              {/* Apariencia */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-medium">{t.settings.appearance}</p>
                <div className="flex gap-2 flex-wrap">
                  {THEMES.map(th => (
                    <button
                      key={th.id}
                      onClick={() => setTheme(th.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        theme === th.id
                          ? "border-accent-purple/60 bg-accent-purple/10 text-text-primary"
                          : "border-border text-text-muted hover:border-accent-purple/30"
                      }`}
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: th.color }} />
                      {lang === "es" ? th.label_es : th.label_en}
                      {theme === th.id && <Check size={11} className="text-accent-purple" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notificaciones push */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-medium">Notificaciones</p>
                {push.state === "unsupported" ? (
                  <p className="text-xs text-text-muted">No soportado en este navegador</p>
                ) : push.state === "granted" ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-status-success flex items-center gap-1.5">
                      <Bell size={12}/> Activadas
                    </span>
                    <button onClick={push.unsubscribe}
                      className="text-xs text-text-muted hover:text-status-error transition-colors">
                      Desactivar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={push.requestPermission}
                    disabled={push.state === "denied" || push.state === "loading"}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-text-secondary hover:border-accent-purple/40 transition-all disabled:opacity-50"
                  >
                    <Bell size={13} className="text-accent-purple"/>
                    {push.state === "denied" ? "Bloqueadas en el navegador" : "Activar notificaciones"}
                  </button>
                )}
              </div>

              {/* Idioma */}
              <div>
                <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-medium">{t.settings.language}</p>
                <div className="flex gap-2">
                  {(["es", "en"] as Lang[]).map(l => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-4 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        lang === l
                          ? "border-accent-purple/60 bg-accent-purple/10 text-text-primary"
                          : "border-border text-text-muted hover:border-accent-purple/30"
                      }`}
                    >
                      {l === "es" ? "Español" : "English"}
                      {lang === l && <Check size={11} className="text-accent-purple inline ml-1.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Avatar + streak */}
        <div className="flex flex-col items-center gap-2 pt-2">
          <AvatarUpload
            currentUrl={user.profile_photo_url}
            size={96}
            onSuccess={() => refreshUser()}
          />
          <StreakBadge initialStreak={(user as any).current_streak ?? 0} showToast={false} />
        </div>

        {/* Story Highlights */}
        <StoryHighlights userId={user.id} isOwn={true} />

        {/* Mi perfil — stats privados, completitud, username, albums */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Shield size={15} className="text-accent-purple" />
              Mi perfil
            </h2>
            <button
              onClick={() => setShowEditProfile(true)}
              className="text-xs text-accent-purple hover:opacity-80 transition-opacity flex items-center gap-1"
            >
              <Settings size={12} /> Editar datos
            </button>
          </div>
          <MyProfileSection />
        </Card>

        {/* Perfil e identidad — tipo + orientación (colapsado) */}
        <Card className="p-5 border-accent-purple/15">
          <details>
            <summary className="font-semibold text-sm flex items-center gap-2 cursor-pointer list-none">
              <Shield size={15} className="text-accent-purple" />
              {t.profile.title}
            </summary>
            <div className="mt-4">
              <ProfileTypeSettings onSaved={() => refreshUser()} />
            </div>
          </details>
        </Card>

        {/* Cuenta */}
        <Card glow className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Shield size={15} className="text-accent-purple" />
              {t.account.title}
            </h2>
            <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
              user.membership_type !== "none"
                ? "bg-status-success/8 text-status-success border-status-success/25"
                : "border-border text-text-muted"
            }`}>
              {user.membership_type === "none"
                ? t.account.noMembership
                : user.membership_type === "monthly"
                  ? t.account.monthly
                  : t.account.lifetime}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wide mb-0.5">{t.account.name}</p>
              <p className="font-medium text-sm">{user.first_name} {user.last_name}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wide mb-0.5">{t.account.role}</p>
              <p className="font-medium text-sm capitalize">{user.role}</p>
            </div>
            <div>
              <p className="text-[11px] text-text-muted uppercase tracking-wide mb-0.5">{t.account.status}</p>
              <p className="font-medium text-sm text-status-success">{t.common.active}</p>

            </div>
            {user.province && (
              <div>
                <p className="text-[11px] text-text-muted uppercase tracking-wide mb-0.5">{t.account.province}</p>
                <p className="font-medium text-sm">{user.province}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Quién vio mi perfil */}
        {viewers.length > 0 && (
          <Card className="p-4">
            <button
              onClick={() => setShowViewers(v => !v)}
              className="w-full flex items-center justify-between"
            >
              <span className="text-sm font-semibold flex items-center gap-2">
                <Eye size={15} className="text-accent-purple" />
                Quién vio tu perfil
                <span className="text-xs text-text-muted font-normal">({viewers.length})</span>
              </span>
              <span className="text-xs text-accent-purple">{showViewers ? "Ocultar" : "Ver"}</span>
            </button>
            {showViewers && (
              <div className="mt-3 space-y-2">
                {viewers.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => navigate(`/profile/${v.id}`)}
                    className="w-full flex items-center gap-3 hover:bg-bg-muted/50 rounded-xl px-2 py-1.5 transition-colors text-left"
                  >
                    {v.profile_photo_url
                      ? <img src={v.profile_photo_url} alt="" className="w-9 h-9 rounded-full object-cover border border-border/40 flex-shrink-0" />
                      : <div className="w-9 h-9 rounded-full bg-bg-muted border border-border/40 flex items-center justify-center flex-shrink-0"><User size={14} className="text-text-muted" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.first_name} {v.last_name}</p>
                      <p className="text-xs text-text-muted">{v.province ?? ""}</p>
                    </div>
                    <Heart size={13} className="text-text-muted flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {user.membership_type === "none" && <MembershipCTA />}

        {/* Seguridad */}
        <SecuritySection />
      </main>

      <BottomNav />
    </div>
  );
}

function SecuritySection() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors w-full py-2"
      >
        <Shield size={14} className="text-accent-purple/60" />
        <span>Seguridad y sesiones</span>
        <span className="ml-auto text-text-muted/60 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <SecuritySettings />}
    </div>
  );
}

function MembershipCTA() {
  const navigate = useNavigate();
  const { t } = useLangStore();
  const { data, isLoading } = usePricingPlans();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) return null;

  const plans  = data?.plans ?? [];
  const blue   = data?.dolar_blue;
  const monthly = plans.find(p => p.id === "monthly");

  return (
    <Card className="p-5 border-accent-purple/25 bg-gradient-card">
      <h3 className="font-bold mb-1 text-sm">{t.membership.activate}</h3>
      <p className="text-text-secondary text-xs mb-4">{t.membership.desc}</p>

      {!showAll && monthly && (
        <div className="mb-4">
          <p className="brand-title" style={{ fontSize: "var(--fs-display-l)" }}>{formatARS(monthly.price_ars)}<span className="text-text-muted text-sm font-normal" style={{ fontFamily: "var(--font-sans)" }}>{t.membership.perMonth}</span></p>
          <p className="text-text-muted text-xs mt-1">{t.membership.international}: {formatUSD(monthly.price_usd)}{t.membership.perMonth}</p>
          {blue && <p className="text-text-muted text-xs">{t.membership.blueToday}: {formatARS(blue.sell)}</p>}
        </div>
      )}

      {showAll && (
        <div className="grid grid-cols-1 gap-2 mb-4">
          {plans.map(p => (
            <div key={p.id} className={`p-4 rounded-xl border ${
              p.id === "annual" ? "border-accent-purple/40 bg-accent-purple/6" : "border-border bg-bg-muted/50"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{p.label}</p>
                  {p.savings && <p className="text-status-success text-xs">{t.membership.save} {p.savings.pct}% {t.membership.vsMonthly}</p>}
                </div>
                <div className="text-right">
                  <p className="brand-title" style={{ fontSize: "var(--fs-display-m)" }}>{formatARS(p.price_ars)}</p>
                  <p className="text-text-muted text-xs">{formatUSD(p.price_usd)} USD</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-center">
        <Button size="sm" onClick={() => navigate(`/checkout?plan=${showAll ? "annual" : "monthly"}&currency=ARS`)}>
          {t.membership.subscribe}
        </Button>
        <button onClick={() => setShowAll(v => !v)} className="text-xs text-accent-purple hover:underline">
          {showAll ? t.membership.viewLess : t.membership.viewAll}
        </button>
      </div>
    </Card>
  );
}
