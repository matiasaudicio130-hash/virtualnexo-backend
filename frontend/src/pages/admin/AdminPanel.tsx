import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, paymentsApi, settingsApi, reportsApi, payoutsApi, mediaApi, adsApi, moderationApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useDolarBlue, usePricingPlans, formatARS, formatUSD } from "@/hooks/useExchangeRate";
import { APP_CONFIG } from "@/config/app";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Shield, Key, Users, BarChart3, LogOut, Plus, CheckCircle, XCircle,
  Wallet, History, Settings as SettingsIcon, TrendingUp, AlertCircle,
  FileText, Download, Share2, Megaphone, Search, Ban, Eye, EyeOff, Crown,
  UserPlus, ExternalLink, Flag, AlertTriangle, Trash2 as TrashIcon, UserX,
} from "lucide-react";
import type { MasterKey, Payment, RevenueStats, AuditLogEntry, SystemSetting, Plan } from "@/types";

type Tab = "stats" | "keys" | "users" | "pending" | "payments" | "reports" | "payouts" | "ads" | "leaks" | "settings" | "audit" | "moderation";

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tab, setTab] = useState<Tab>("stats");
  const dolar = useDolarBlue();

  useEffect(() => {
    if (user?.role !== "admin") navigate("/dashboard");
  }, [user]);

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: "stats",    label: "Resumen",     icon: BarChart3 },
    { id: "users",    label: "Usuarios",    icon: Users },
    { id: "keys",     label: "Master Keys", icon: Key },
    { id: "payments", label: "Pagos",       icon: Wallet },
    { id: "reports",  label: "Reportes",    icon: FileText },
    { id: "payouts",  label: "Payouts",     icon: Share2 },
    { id: "ads",      label: "Anuncios",    icon: Megaphone },
    { id: "leaks",    label: "Filtraciones",icon: Shield },
    { id: "moderation", label: "Moderación", icon: Flag },
    { id: "pending",    label: "Pendientes", icon: Users },
    { id: "settings",   label: "Ajustes",    icon: SettingsIcon },
    { id: "audit",      label: "Auditoría",  icon: History },
  ];

  return (
    <div className="min-h-screen bg-bg-base text-text-primary animate-fade-in">
      <header className="sticky top-0 z-10 bg-bg-base/80 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-accent-purple" />
          <span className="font-bold">{APP_CONFIG.name} Admin</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Cotización dólar en header */}
          {dolar.data && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-accent-purple/5 border border-accent-purple/20 rounded-lg text-xs">
              <TrendingUp size={12} className="text-accent-purple" />
              <span className="text-text-muted">Blue:</span>
              <span className="font-semibold text-accent-purple">{formatARS(dolar.data.sell)}</span>
              {dolar.data.stale && <AlertCircle size={12} className="text-status-warning" />}
            </div>
          )}
          <button onClick={() => { logout(); navigate("/login"); }} className="p-2 hover:bg-bg-muted rounded-xl">
            <LogOut size={18} className="text-text-muted" />
          </button>
        </div>
      </header>

      <div className="flex border-b border-border px-4 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={"flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap " + (
              tab === id ? "border-accent-purple text-accent-purple" : "border-transparent text-text-muted hover:text-text-primary"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {tab === "stats"    && <StatsTab />}
        {tab === "users"    && <UsersTab />}
        {tab === "keys"     && <KeysTab />}
        {tab === "payments" && <PaymentsTab />}
        {tab === "reports"  && <ReportsTab />}
        {tab === "payouts"  && <PayoutsTab />}
        {tab === "ads"      && <AdsTab />}
        {tab === "leaks"    && <LeakVerifierTab />}
        {tab === "pending"  && <PendingTab />}
        {tab === "settings" && <SettingsTab />}
        {tab === "audit"      && <AuditTab />}
        {tab === "moderation" && <ModerationTab />}
      </main>
    </div>
  );
}

// ============================================================
// NUEVOS USUARIOS (semillas)
// ============================================================
function NewUsersSection() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listUsers({ limit: 50 })
      .then(r => {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        setUsers((r.data as any[]).filter(u =>
          u.status === "active" && new Date(u.created_at).getTime() > cutoff
        ));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  if (loading) return null;
  if (users.length === 0) return (
    <Card className="p-5">
      <p className="text-sm font-semibold flex items-center gap-2 mb-1">
        <UserPlus size={15} className="text-accent-purple"/> Nuevos usuarios (últimos 7 días)
      </p>
      <p className="text-xs text-text-muted">Sin nuevos usuarios activos esta semana.</p>
    </Card>
  );

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <UserPlus size={15} className="text-accent-purple"/> Nuevos usuarios (últimos 7 días)
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Seguí a estas personas desde tus cuentas semilla para que el feed se sienta activo.
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 bg-accent-purple/10 text-accent-purple rounded-full font-medium">
          {users.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {users.map(u => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            {u.profile_photo_url
              ? <img src={u.profile_photo_url} alt="" className="w-9 h-9 rounded-full object-cover border border-border/40 flex-shrink-0"/>
              : <div className="w-9 h-9 rounded-full bg-bg-muted border border-border/40 flex items-center justify-center flex-shrink-0 text-text-muted text-xs font-medium">{u.first_name?.[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{u.first_name} {u.last_name}</p>
              <p className="text-[11px] text-text-muted">
                {u.username ? `@${u.username} · ` : ""}{u.city || u.province || "Sin ubicación"} · {new Date(u.created_at).toLocaleDateString("es-AR")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => copyId(u.id)}
                className="text-[10px] px-2 py-1 rounded-lg border border-border text-text-muted hover:border-accent-purple/40 hover:text-accent-purple transition-colors"
                title="Copiar ID para vincular/seguir"
              >
                {copied === u.id ? "✓ Copiado" : "ID"}
              </button>
              <button
                onClick={() => navigate(`/profile/${u.id}`)}
                className="p-1.5 rounded-lg border border-border text-text-muted hover:border-accent-purple/40 hover:text-accent-purple transition-colors"
                title="Ver perfil"
              >
                <ExternalLink size={13}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// RESUMEN
// ============================================================
function StatsTab() {
  const [userStats, setUserStats] = useState<Record<string, number>>({});
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const dolar = useDolarBlue();
  const pricing = usePricingPlans();
  const monthly = pricing.data?.plans.find((p) => p.id === "monthly");

  useEffect(() => {
    adminApi.stats().then((r) => setUserStats(r.data));
    paymentsApi.stats().then((r) => setRevenue(r.data));
  }, []);

  return (
    <div className="space-y-6">
      {/* Ingresos — ARS como primario */}
      {revenue && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card glow className="p-5">
            <p className="text-text-muted text-xs mb-1">Ingresos este mes</p>
            <p className="text-3xl font-bold text-accent-purple">{formatARS(revenue.this_month_ars)}</p>
            <p className="text-text-muted text-xs mt-1">{formatUSD(revenue.this_month_usd)} · {revenue.this_month_count} pagos</p>
          </Card>
          <Card className="p-5">
            <p className="text-text-muted text-xs mb-1">Ingresos totales</p>
            <p className="text-3xl font-bold">{formatARS(revenue.total_ars)}</p>
            <p className="text-text-muted text-xs mt-1">{formatUSD(revenue.total_usd)} · {revenue.total_payments} pagos</p>
          </Card>
          <Card className="p-5">
            <p className="text-text-muted text-xs mb-1">Dólar Blue ahora</p>
            <p className="text-3xl font-bold">{dolar.data ? formatARS(dolar.data.sell) : "-"}</p>
            <p className="text-text-muted text-xs mt-1">{dolar.data?.source ?? "-"}</p>
          </Card>
        </div>
      )}

      {/* Breakdown por método */}
      {revenue && Object.keys(revenue.by_method).length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">Ingresos por método de pago</h3>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(revenue.by_method).map(([method, data]) => (
              <div key={method} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="capitalize text-text-secondary">{method}</span>
                <div className="text-right">
                  <p className="font-semibold">{formatARS(data.ars)}</p>
                  <p className="text-text-muted text-xs">{data.count} pago{data.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Precios vigentes */}
      {monthly && (
        <Card className="p-5 border-accent-purple/30 bg-accent-purple/5">
          <h3 className="font-semibold mb-3 text-sm">Precios actuales</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            {(pricing.data?.plans ?? []).map((p) => (
              <div key={p.id}>
                <p className="text-text-muted text-xs mb-1">{p.label}</p>
                <p className="font-bold">{formatARS(p.price_ars)}</p>
                <p className="text-text-muted text-xs">{formatUSD(p.price_usd)} USD</p>
              </div>
            ))}
          </div>
          <p className="text-text-muted text-xs mt-3 text-center">
            Editá estos precios en la pestaña <span className="text-accent-purple">Ajustes → Precios</span>
          </p>
        </Card>
      )}

      {/* Usuarios por estado */}
      <div>
        <h3 className="text-sm font-semibold text-text-muted mb-3 uppercase tracking-wider">Usuarios por estado</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(userStats).map(([k, v]) => (
            <Card key={k} className="p-4">
              <p className="text-text-muted text-xs capitalize mb-1">{k.replace(/_/g, " ")}</p>
              <p className="text-2xl font-bold">{v}</p>
            </Card>
          ))}
        </div>
      </div>

      <NewUsersSection />
    </div>
  );
}

// ============================================================
// USUARIOS
// ============================================================
const STATUS_COLORS: Record<string, string> = {
  active:          "bg-status-success/20 text-status-success",
  pending_email:   "bg-status-warning/20 text-status-warning",
  pending_kyc:     "bg-status-warning/20 text-status-warning",
  pending_manual:  "bg-accent-purple/20 text-accent-purple",
  suspended:       "bg-status-error/20 text-status-error",
  rejected:        "bg-status-error/20 text-status-error",
};
const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-accent-purple/20 text-accent-purple",
  influencer: "bg-blue-500/20 text-blue-400",
  socio:      "bg-status-success/20 text-status-success",
  miembro:    "bg-bg-muted text-text-muted",
};

function UsersTab() {
  const [users, setUsers]       = useState<any[]>([]);
  const [search, setSearch]     = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRole, setFilterRole]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState<{msg: string; ok: boolean} | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (filterStatus) params.status = filterStatus;
      if (filterRole)   params.role   = filterRole;
      const { data } = await adminApi.listUsers(params);
      setUsers(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filterStatus, filterRole]);

  const notify = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 3000);
  };

  async function suspend(id: string) {
    await adminApi.suspendUser(id);
    notify("Usuario suspendido");
    load();
  }

  async function shadowBan(id: string, active: boolean) {
    if (active) {
      await adminApi.shadowBan(id);
      notify("Shadow ban aplicado");
    } else {
      await adminApi.removeShadowBan(id);
      notify("Shadow ban removido");
    }
    load();
  }

  async function assignMembership(id: string, type: string) {
    const days = type === "monthly" ? 30 : type === "annual" ? 365 : 0;
    await adminApi.assignMembership(id, type, days);
    notify("Membresía asignada");
    load();
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={"p-3 rounded-xl text-sm border " + (feedback.ok
          ? "bg-status-success/10 border-status-success/30 text-status-success"
          : "bg-status-error/10 border-status-error/30 text-status-error")}>
          {feedback.msg}
        </div>
      )}

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activo</option>
            <option value="pending_email">Pendiente email</option>
            <option value="pending_kyc">Pendiente KYC</option>
            <option value="pending_manual">Pendiente manual</option>
            <option value="suspended">Suspendido</option>
            <option value="rejected">Rechazado</option>
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
          >
            <option value="">Todos los roles</option>
            <option value="miembro">Miembro</option>
            <option value="influencer">Influencer</option>
            <option value="socio">Socio</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <p className="text-text-muted text-xs mt-2">
          {loading ? "Cargando…" : `${filtered.length} usuario${filtered.length !== 1 ? "s" : ""}`}
        </p>
      </Card>

      {/* Lista */}
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {filtered.map((u) => {
            const isExpanded = expanded === u.id;
            return (
              <div key={u.id}>
                {/* Fila principal */}
                <div
                  className="p-4 flex items-center gap-3 cursor-pointer hover:bg-bg-muted/40 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : u.id)}
                >
                  {/* Avatar placeholder */}
                  <div className="w-9 h-9 rounded-full bg-accent-purple/20 flex items-center justify-center flex-shrink-0 text-accent-purple font-bold text-sm">
                    {(u.first_name?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {u.first_name} {u.last_name}
                    </p>
                    <p className="text-text-muted text-xs truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (STATUS_COLORS[u.status] ?? "bg-bg-muted text-text-muted")}>
                      {u.status?.replace(/_/g, " ")}
                    </span>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (ROLE_COLORS[u.role] ?? "bg-bg-muted text-text-muted")}>
                      {u.role}
                    </span>
                    {u.is_shadow_banned && (
                      <EyeOff size={13} className="text-status-error" />
                    )}
                  </div>
                </div>

                {/* Panel expandido con detalles y acciones */}
                {isExpanded && (
                  <div className="px-4 pb-4 bg-bg-muted/30 border-t border-border/50 space-y-3">
                    {/* Info */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                      <div>
                        <p className="text-text-muted mb-0.5">Membresía</p>
                        <p className="font-medium capitalize">{u.membership_type ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-0.5">Vence</p>
                        <p className="font-medium">
                          {u.membership_expires_at
                            ? new Date(u.membership_expires_at).toLocaleDateString("es-AR")
                            : u.membership_type === "lifetime" ? "Vitalicio" : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-0.5">Registrado</p>
                        <p className="font-medium">{u.created_at ? new Date(u.created_at).toLocaleDateString("es-AR") : "—"}</p>
                      </div>
                      <div>
                        <p className="text-text-muted mb-0.5">Último acceso</p>
                        <p className="font-medium">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString("es-AR") : "—"}</p>
                      </div>
                      {u.province && (
                        <div>
                          <p className="text-text-muted mb-0.5">Provincia</p>
                          <p className="font-medium">{u.province}{u.city ? `, ${u.city}` : ""}</p>
                        </div>
                      )}
                      {u.master_key_used && (
                        <div className="sm:col-span-2">
                          <p className="text-text-muted mb-0.5">Master key usada</p>
                          <code className="text-accent-purple">{u.master_key_used}</code>
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {/* Membresía rápida */}
                      <div className="flex items-center gap-1">
                        <Crown size={13} className="text-text-muted" />
                        <select
                          defaultValue=""
                          onChange={(e) => { if (e.target.value) assignMembership(u.id, e.target.value); }}
                          className="px-2 py-1.5 rounded-lg bg-bg-muted border border-border text-xs focus:outline-none focus:ring-1 focus:ring-accent-purple"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="" disabled>Asignar membresía…</option>
                          <option value="monthly">Mensual (30 días)</option>
                          <option value="annual">Anual (365 días)</option>
                          <option value="lifetime">Vitalicio</option>
                        </select>
                      </div>

                      {/* Shadow ban toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); shadowBan(u.id, !u.is_shadow_banned); }}
                        className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors " + (
                          u.is_shadow_banned
                            ? "border-status-success/40 text-status-success hover:bg-status-success/10"
                            : "border-border text-text-muted hover:border-status-warning/40 hover:text-status-warning"
                        )}
                      >
                        {u.is_shadow_banned ? <><Eye size={12}/> Quitar shadow ban</> : <><EyeOff size={12}/> Shadow ban</>}
                      </button>

                      {/* Suspender */}
                      {u.status !== "suspended" && u.role !== "admin" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); suspend(u.id); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border text-text-muted hover:border-status-error/40 hover:text-status-error transition-colors"
                        >
                          <Ban size={12}/> Suspender
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!loading && filtered.length === 0 && (
            <p className="text-text-muted text-sm text-center py-10">Sin resultados</p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// MASTER KEYS
// ============================================================
function KeysTab() {
  const [keys, setKeys] = useState<MasterKey[]>([]);
  const [form, setForm] = useState({ type: "gratis", discount_pct: 0, max_uses: 1, notes: "" });
  const [batchQty, setBatchQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const load = () => adminApi.listKeys().then((r) => setKeys(r.data));
  useEffect(() => { load(); }, []);

  async function createKey() {
    setLoading(true);
    try {
      if (batchQty > 1) {
        await adminApi.createKeyBatch({ quantity: batchQty, ...form });
        setFeedback(batchQty + " keys generadas");
      } else {
        await adminApi.createKey(form);
        setFeedback("Key generada");
      }
      load();
      setTimeout(() => setFeedback(""), 3000);
    } catch { setFeedback("Error al generar key"); }
    setLoading(false);
  }

  async function deactivate(id: string) {
    await adminApi.deactivateKey(id);
    load();
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Plus size={16} /> Generar Keys</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
            >
              <option value="gratis">Gratis</option>
              <option value="descuento">Descuento</option>
              <option value="temporal">Temporal</option>
              <option value="vitalicio">Vitalicio</option>
            </select>
          </div>
          <Input label="Usos máximos" type="number" min={1}
                 value={form.max_uses}
                 onChange={(e) => setForm({ ...form, max_uses: parseInt(e.target.value) || 1 })} />
          {form.type === "descuento" && (
            <Input label="Descuento (%)" type="number" min={0} max={100}
                   value={form.discount_pct}
                   onChange={(e) => setForm({ ...form, discount_pct: parseInt(e.target.value) || 0 })} />
          )}
          <Input label="Notas (opcional)" placeholder="Ej: Influencer Q1"
                 value={form.notes}
                 onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Input label="Cantidad a generar" type="number" min={1} max={100}
                 value={batchQty}
                 onChange={(e) => setBatchQty(parseInt(e.target.value) || 1)} />
        </div>
        {feedback && <p className="text-sm text-status-success mt-3">{feedback}</p>}
        <Button className="mt-4" loading={loading} onClick={createKey}>
          <Key size={16} /> Generar {batchQty > 1 ? (batchQty + " Keys") : "Key"}
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Keys ({keys.length})</h2></div>
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {keys.map((k) => (
            <div key={k.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <code className="text-accent-purple font-mono text-sm">{k.code}</code>
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className="text-xs text-text-muted capitalize bg-bg-muted px-2 py-0.5 rounded-md">{k.type}</span>
                  <span className="text-xs text-text-muted">{k.uses_count}/{k.max_uses} usos</span>
                  {!k.is_active && <span className="text-xs text-status-error">inactiva</span>}
                  {k.notes && <span className="text-xs text-text-muted truncate">{k.notes}</span>}
                </div>
              </div>
              {k.is_active && (
                <button onClick={() => deactivate(k.id)} className="text-status-error hover:opacity-70">
                  <XCircle size={18} />
                </button>
              )}
            </div>
          ))}
          {keys.length === 0 && <p className="text-text-muted text-sm text-center py-8">No hay keys</p>}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// PAGOS (manual + listado)
// ============================================================
function PaymentsTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    user_id: "", plan: "monthly", currency: "ARS", method: "cash",
    reference: "", notes: "",
  });
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const pricing = usePricingPlans();

  const selectedPlan = pricing.data?.plans.find((p) => p.id === form.plan);
  const previewPrice = selectedPlan
    ? form.currency === "ARS"
      ? formatARS(selectedPlan.price_ars)
      : formatUSD(selectedPlan.price_usd)
    : null;

  const load = () => {
    paymentsApi.list({ limit: 100 }).then((r) => setPayments(r.data));
    adminApi.listUsers({ limit: 100 }).then((r) => setUsers(r.data));
  };
  useEffect(() => { load(); }, []);

  async function createPayment() {
    if (!form.user_id) { setFeedback("Seleccioná un usuario"); return; }
    setLoading(true);
    try {
      await paymentsApi.createManual(form);
      setFeedback("Pago registrado y membresía activada");
      load();
      setTimeout(() => setFeedback(""), 3000);
    } catch (e: any) {
      setFeedback(e.response?.data?.detail ?? "Error");
    }
    setLoading(false);
  }

  const userMap = new Map(users.map((u) => [u.id, u]));
  const sel = (v: string, field: string) => setForm((f) => ({ ...f, [field]: v }));

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2"><Plus size={16} /> Registrar pago manual</h2>
        <p className="text-text-muted text-xs mb-4">Para efectivo, transferencia, MP u otros métodos offline. Activa la membresía automáticamente al precio del plan elegido.</p>

        {previewPrice && (
          <div className="mb-4 p-3 bg-accent-purple/5 border border-accent-purple/20 rounded-xl text-sm flex items-center justify-between">
            <span className="text-text-muted">Precio a cobrar:</span>
            <span className="font-bold text-accent-purple text-lg">{previewPrice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Usuario */}
          <div className="sm:col-span-2">
            <label className="text-sm text-text-secondary mb-1 block">Usuario</label>
            <select value={form.user_id} onChange={(e) => sel(e.target.value, "user_id")}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple">
              <option value="">— Seleccionar —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
              ))}
            </select>
          </div>

          {/* Plan */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Plan</label>
            <select value={form.plan} onChange={(e) => sel(e.target.value, "plan")}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple">
              <option value="monthly">Mensual</option>
              <option value="annual">Anual</option>
              <option value="lifetime">Vitalicio</option>
            </select>
          </div>

          {/* Moneda */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Moneda del pago</label>
            <select value={form.currency} onChange={(e) => sel(e.target.value, "currency")}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple">
              <option value="ARS">ARS — Argentina (precio fijo en pesos)</option>
              <option value="USD">USD — Internacional</option>
            </select>
          </div>

          {/* Método */}
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Método</label>
            <select value={form.method} onChange={(e) => sel(e.target.value, "method")}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple">
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="mercadopago">MercadoPago</option>
              <option value="crypto">Cripto</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <Input label="Referencia (ticket, nro op.)"
                 value={form.reference}
                 onChange={(e) => sel(e.target.value, "reference")} />
          <Input label="Notas (opcional)"
                 value={form.notes}
                 onChange={(e) => sel(e.target.value, "notes")} />
        </div>

        {feedback && <p className={"text-sm mt-3 " + (feedback.startsWith("Error") ? "text-status-error" : "text-status-success")}>{feedback}</p>}
        <Button className="mt-4" loading={loading} onClick={createPayment}>
          <Wallet size={16} /> Registrar pago
        </Button>
      </Card>

      {/* Historial */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border"><h2 className="font-semibold">Historial ({payments.length})</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg-muted text-text-muted text-xs uppercase">
              <tr>
                <th className="text-left p-3">Usuario</th>
                <th className="text-left p-3">Método</th>
                <th className="text-right p-3">ARS</th>
                <th className="text-right p-3">USD</th>
                <th className="text-left p-3">Plan</th>
                <th className="text-left p-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const u = userMap.get(p.user_id);
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-bg-muted/40 transition-colors">
                    <td className="p-3 text-sm">{u ? (u.first_name + " " + u.last_name) : p.user_id.slice(0, 8)}</td>
                    <td className="p-3 capitalize text-text-secondary">{p.method}</td>
                    <td className="p-3 text-right font-semibold text-accent-purple">{formatARS(p.amount_ars)}</td>
                    <td className="p-3 text-right text-text-secondary">{formatUSD(p.amount_usd)}</td>
                    <td className="p-3 capitalize text-text-secondary">{p.membership_type}</td>
                    <td className="p-3 text-text-muted text-xs">{new Date(p.created_at).toLocaleDateString("es-AR")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {payments.length === 0 && <p className="text-text-muted text-sm text-center py-8">No hay pagos registrados</p>}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// PENDIENTES
// ============================================================
function PendingTab() {
  const [pending, setPending] = useState<any[]>([]);
  const load = () => adminApi.pendingManual().then((r) => setPending(r.data));
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    await adminApi.approveUser(id);
    load();
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Usuarios pendientes de aprobación manual ({pending.length})</h2>
        <p className="text-text-muted text-xs mt-1">Ingresaron con master key y esperan tu aprobación</p>
      </div>
      <div className="divide-y divide-border">
        {pending.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{u.first_name} {u.last_name}</p>
              <p className="text-text-muted text-sm">{u.email}</p>
              <p className="text-text-muted text-xs mt-0.5">Key: <code className="text-accent-purple">{u.master_key_used}</code></p>
            </div>
            <Button size="sm" onClick={() => approve(u.id)}>
              <CheckCircle size={14} /> Aprobar
            </Button>
          </div>
        ))}
        {pending.length === 0 && <p className="text-text-muted text-sm text-center py-8">Sin pendientes</p>}
      </div>
    </Card>
  );
}

// ============================================================
// SETTINGS / PRECIOS + FEATURE FLAGS
// ============================================================
const PLAN_LABELS: Record<string, string> = {
  monthly: "Mensual", annual: "Anual", lifetime: "Vitalicio",
};

function SettingsTab() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [feedback, setFeedback] = useState("");
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  const load = () => settingsApi.all().then((r) => {
    setSettings(r.data);
    // Inicializar edits con valores actuales
    const edits: Record<string, string> = {};
    for (const s of r.data) {
      if (s.key.startsWith("price_")) edits[s.key] = String(s.value);
    }
    setPriceEdits(edits);
  });

  useEffect(() => { load(); }, []);

  const priceSettings = settings.filter((s) => s.key.startsWith("price_"));
  const featureSettings = settings.filter((s) => s.key.startsWith("feature_"));

  async function savePrices() {
    setSavingPrices(true);
    try {
      await Promise.all(
        Object.entries(priceEdits).map(([key, val]) =>
          settingsApi.update(key, parseFloat(val) || 0)
        )
      );
      setFeedback("Precios actualizados correctamente");
      load();
      setTimeout(() => setFeedback(""), 3000);
    } catch { setFeedback("Error al guardar precios"); }
    setSavingPrices(false);
  }

  async function toggle(key: string, current: any) {
    const newValue = !(current === true || current === "true");
    await settingsApi.update(key, newValue);
    setFeedback(key.replace("feature_", "").replace(/_/g, " ") + ": " + (newValue ? "activado" : "desactivado"));
    load();
    setTimeout(() => setFeedback(""), 3000);
  }

  // Organizar precios en tabla: plan × moneda
  const plans = ["monthly", "annual", "lifetime"];
  const currencies = ["ars", "usd"];

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={"p-3 rounded-xl text-sm border " + (feedback.startsWith("Error") ? "bg-status-error/10 border-status-error/30 text-status-error" : "bg-status-success/10 border-status-success/30 text-status-success")}>
          {feedback}
        </div>
      )}

      {/* â"€â"€ PRECIOS â"€â"€ */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Precios de membresía</h2>
            <p className="text-text-muted text-xs mt-0.5">ARS = precio fijo para Argentina · USD = precio para internacional</p>
          </div>
          <Button size="sm" loading={savingPrices} onClick={savePrices}>Guardar precios</Button>
        </div>
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-text-muted font-normal pb-3">Plan</th>
                <th className="text-right text-text-muted font-normal pb-3">ARS (Argentina)</th>
                <th className="text-right text-text-muted font-normal pb-3">USD (Internacional)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plans.map((plan) => {
                const arsKey = "price_" + plan + "_ars";
                const usdKey = "price_" + plan + "_usd";
                return (
                  <tr key={plan}>
                    <td className="py-3 font-medium">{PLAN_LABELS[plan]}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-text-muted text-xs">$</span>
                        <input
                          type="number"
                          min={0}
                          value={priceEdits[arsKey] ?? ""}
                          onChange={(e) => setPriceEdits((p) => ({ ...p, [arsKey]: e.target.value }))}
                          className="w-28 px-3 py-1.5 rounded-lg bg-bg-muted border border-border text-right focus:outline-none focus:ring-2 focus:ring-accent-purple"
                        />
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <span className="text-text-muted text-xs">USD</span>
                        <input
                          type="number"
                          min={0}
                          value={priceEdits[usdKey] ?? ""}
                          onChange={(e) => setPriceEdits((p) => ({ ...p, [usdKey]: e.target.value }))}
                          className="w-24 px-3 py-1.5 rounded-lg bg-bg-muted border border-border text-right focus:outline-none focus:ring-2 focus:ring-accent-purple"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-text-muted text-xs mt-4">
            Los cambios se reflejan inmediatamente en el dashboard del usuario y en el formulario de pagos manuales.
          </p>
        </div>
      </Card>

      {/* â"€â"€ FEATURE FLAGS â"€â"€ */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Features</h2>
          <p className="text-text-muted text-xs mt-0.5">Activá o desactivá módulos sin tocar código</p>
        </div>
        <div className="divide-y divide-border">
          {featureSettings.map((s) => {
            const enabled = s.value === true || s.value === "true";
            const label = s.key.replace("feature_", "").replace(/_/g, " ");
            return (
              <div key={s.key} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium capitalize">{label}</p>
                  {s.description && <p className="text-text-muted text-xs mt-0.5">{s.description}</p>}
                </div>
                <button
                  onClick={() => toggle(s.key, s.value)}
                  className={"relative w-12 h-6 rounded-full transition-colors flex-shrink-0 " + (enabled ? "bg-accent-purple" : "bg-bg-muted border border-border")}
                >
                  <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform " + (enabled ? "translate-x-6" : "translate-x-0.5")} />
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// REPORTES PDF
// ============================================================
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                     "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function ReportsTab() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dlLoading, setDlLoading] = useState<"monthly"|"annual"|null>(null);

  async function loadPreview() {
    setLoading(true);
    try {
      const { data } = await reportsApi.preview(year, month);
      setPreview(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadPreview(); }, [year, month]);

  async function download(type: "monthly" | "annual") {
    setDlLoading(type);
    try {
      const res = type === "monthly"
        ? await reportsApi.monthly(year, month)
        : await reportsApi.annual(year);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = type === "monthly"
        ? "reporte_" + MONTH_NAMES[month-1].toLowerCase() + "_" + year + ".pdf"
        : "reporte_anual_" + year + ".pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Error al generar el PDF"); }
    setDlLoading(null);
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="space-y-6">
      {/* Selector */}
      <Card className="p-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><FileText size={16}/> Reportes Financieros</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Año</label>
            <select value={year} onChange={e => setYear(+e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-text-secondary mb-1 block">Mes</label>
            <select value={month} onChange={e => setMonth(+e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple">
              {MONTH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Preview del mes seleccionado */}
        {loading && <p className="text-text-muted text-sm text-center py-4">Cargando datos…</p>}
        {preview && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-bg-muted rounded-xl p-4 text-center">
              <p className="text-text-muted text-xs mb-1">Pagos</p>
              <p className="text-2xl font-bold">{preview.count}</p>
            </div>
            <div className="bg-accent-purple/10 border border-accent-purple/20 rounded-xl p-4 text-center">
              <p className="text-text-muted text-xs mb-1">Total ARS</p>
              <p className="text-xl font-bold text-accent-purple">{formatARS(preview.total_ars)}</p>
            </div>
            <div className="bg-bg-muted rounded-xl p-4 text-center">
              <p className="text-text-muted text-xs mb-1">Total USD</p>
              <p className="text-xl font-bold">{formatUSD(preview.total_usd)}</p>
            </div>
          </div>
        )}

        {/* Botones de descarga */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => download("monthly")}
            loading={dlLoading === "monthly"}
            className="flex-1"
          >
            <Download size={15}/>
            Descargar {MONTH_NAMES[month-1]} {year} (PDF)
          </Button>
          <Button
            onClick={() => download("annual")}
            loading={dlLoading === "annual"}
            className="flex-1 bg-bg-card border border-border text-text-primary hover:bg-bg-muted"
          >
            <Download size={15}/>
            Reporte anual {year} (PDF)
          </Button>
        </div>
        {preview?.count === 0 && (
          <p className="text-text-muted text-xs text-center mt-3">
            No hay pagos completados en {MONTH_NAMES[month-1]} {year}.
          </p>
        )}
      </Card>

      {/* Desglose por método (preview) */}
      {preview && Object.keys(preview.by_method).length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">Vista previa — {MONTH_NAMES[month-1]} {year}</h3>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(preview.by_method).map(([m, d]: [string, any]) => (
              <div key={m} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="capitalize text-text-secondary">{m}</span>
                <div className="text-right">
                  <p className="font-semibold">{formatARS(d.ars)}</p>
                  <p className="text-text-muted text-xs">{d.count} pago{d.count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// PAYOUTS DE INFLUENCERS
// ============================================================
function PayoutsTab() {
  const [summary, setSummary] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ period_start: "", period_end: "", reference: "", notes: "" });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const load = () => {
    payoutsApi.summary().then(r => setSummary(r.data));
    payoutsApi.history().then(r => setHistory(r.data));
  };
  useEffect(() => { load(); }, []);

  async function registerPayout() {
    if (!selected) return;
    if (!form.period_start || !form.period_end) { setFeedback("Completá el período"); return; }
    setLoading(true);
    try {
      await payoutsApi.register({
        influencer_id: selected.influencer_id,
        amount_ars: selected.pending_ars,
        payout_pct: selected.payout_pct,
        period_start: form.period_start,
        period_end: form.period_end,
        reference: form.reference,
        notes: form.notes,
      });
      setFeedback("Liquidación registrada");
      setSelected(null);
      load();
      setTimeout(() => setFeedback(""), 3000);
    } catch (e: any) {
      setFeedback(e.response?.data?.detail ?? "Error");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={"p-3 rounded-xl text-sm border " + (feedback.startsWith("Error") || feedback.startsWith("Completa")
          ? "bg-status-error/10 border-status-error/30 text-status-error"
          : "bg-status-success/10 border-status-success/30 text-status-success")}>
          {feedback}
        </div>
      )}

      {/* Resumen por influencer */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Comisiones pendientes</h2>
            <p className="text-text-muted text-xs mt-0.5">
              Basado en pagos de usuarios referidos por cada influencer
            </p>
          </div>
        </div>
        {summary.length === 0 ? (
          <p className="text-text-muted text-sm text-center py-8">
            Ningún influencer tiene usuarios referidos con pagos todavía.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {summary.map((inf) => (
              <div key={inf.influencer_id}
                className={"p-4 transition-colors " + (selected?.influencer_id === inf.influencer_id ? "bg-accent-purple/5" : "hover:bg-bg-muted/40")}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{inf.influencer_name || "Sin nombre"}</p>
                    <p className="text-text-muted text-xs truncate">{inf.influencer_email}</p>
                    <div className="flex gap-4 mt-1 text-xs text-text-secondary">
                      <span>{inf.referred_users} usuario{inf.referred_users !== 1 ? "s" : ""}</span>
                      <span>{inf.referred_payments} pago{inf.referred_payments !== 1 ? "s" : ""}</span>
                      <span className="text-accent-purple">{inf.payout_pct}% comisión</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-text-muted">Pendiente</p>
                    <p className={"text-lg font-bold " + (inf.pending_ars > 0 ? "text-status-warning" : "text-status-success")}>
                      {formatARS(inf.pending_ars)}
                    </p>
                    <p className="text-text-muted text-xs">de {formatARS(inf.total_owed_ars)} total</p>
                  </div>
                </div>
                {inf.pending_ars > 0 && (
                  <button
                    onClick={() => setSelected(selected?.influencer_id === inf.influencer_id ? null : inf)}
                    className="mt-3 text-xs text-accent-purple hover:underline"
                  >
                    {selected?.influencer_id === inf.influencer_id ? "Cancelar" : "Registrar liquidación →"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Formulario de liquidación */}
      {selected && (
        <Card className="p-5 border-accent-purple/30 bg-accent-purple/5">
          <h3 className="font-semibold mb-1">
            Liquidar a {selected.influencer_name}
          </h3>
          <p className="text-text-muted text-xs mb-4">
            Monto a pagar: <span className="font-bold text-accent-purple">{formatARS(selected.pending_ars)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Período desde" type="date" value={form.period_start}
                   onChange={e => setForm(f => ({...f, period_start: e.target.value}))} />
            <Input label="Período hasta" type="date" value={form.period_end}
                   onChange={e => setForm(f => ({...f, period_end: e.target.value}))} />
            <Input label="Referencia (transferencia, etc.)" value={form.reference}
                   onChange={e => setForm(f => ({...f, reference: e.target.value}))} />
            <Input label="Notas" value={form.notes}
                   onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <Button loading={loading} onClick={registerPayout}>
            Confirmar liquidación de {formatARS(selected.pending_ars)}
          </Button>
        </Card>
      )}

      {/* Historial de liquidaciones */}
      {history.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">Historial de liquidaciones</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-muted text-text-muted text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Influencer</th>
                  <th className="text-left p-3">Período</th>
                  <th className="text-right p-3">ARS</th>
                  <th className="text-left p-3">Ref.</th>
                  <th className="text-left p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className="p-3 text-xs">{h.influencer_id?.slice(0,8)}…</td>
                    <td className="p-3 text-xs text-text-muted">{h.period_start} → {h.period_end}</td>
                    <td className="p-3 text-right font-semibold text-accent-purple">{formatARS(h.amount_ars)}</td>
                    <td className="p-3 text-xs text-text-muted">{h.reference || "-"}</td>
                    <td className="p-3">
                      <span className={"text-xs px-2 py-0.5 rounded-full " + (
                        h.status === "paid" ? "bg-status-success/20 text-status-success" : "bg-status-warning/20 text-status-warning"
                      )}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// ANUNCIOS / ADSERVER
// ============================================================
const AR_PROVINCES: string[] = [
  'Buenos Aires','CABA','Catamarca','Chaco','Chubut','Cordoba','Corrientes',
  'Entre Rios','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones',
  'Neuquen','Rio Negro','Salta','San Juan','San Luis','Santa Cruz',
  'Santa Fe','Santiago del Estero','Tierra del Fuego','Tucuman',
];

const AD_CATEGORIES = [
  { v: "sex_shop",  l: "Sex shop" },
  { v: "hotel",     l: "Hotel / Alojamiento" },
  { v: "motel",     l: "Motel" },
  { v: "bar",       l: "Bar / Restoran" },
  { v: "club",      l: "Club nocturno" },
  { v: "spa",       l: "Spa / Masajes" },
  { v: "pharmacy",  l: "Farmacia" },
  { v: "other",     l: "Otro" },
];

function ImageUploader({
  value, onChange,
}: { value: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(""); setUploading(true);
    try {
      const { data } = await adsApi.uploadImage(file);
      onChange(data.url);
    } catch {
      setErr("Error al subir la imagen");
    }
    setUploading(false);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="space-y-2">
      <label className="text-xs text-text-secondary block">Imagen del anuncio</label>
      {value && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-bg-muted border border-border">
          <img src={value} alt="" className="w-full h-full object-cover" />
          <button
            onClick={() => onChange("")}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <XCircle size={14} />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-accent-purple/50 text-text-muted text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {uploading ? (
          <span className="animate-spin w-4 h-4 border-2 border-accent-purple/30 border-t-accent-purple rounded-full" />
        ) : (
          <Plus size={16} />
        )}
        {uploading ? "Subiendo..." : value ? "Cambiar imagen" : "Subir imagen"}
      </button>
      {err && <p className="text-xs text-status-error">{err}</p>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

function AdForm({
  advertisers, onSave, onCancel, initial,
}: {
  advertisers: any[];
  onSave: (body: any) => Promise<void>;
  onCancel: () => void;
  initial?: any;
}) {
  const [form, setForm] = useState({
    advertiser_id: initial?.advertiser_id ?? "",
    type:          initial?.type ?? "banner",
    title:         initial?.title ?? "",
    description:   initial?.description ?? "",
    image_url:     initial?.image_url ?? "",
    target_url:    initial?.target_url ?? "",
    cta_text:      initial?.cta_text ?? "Ver mas",
    priority:      initial?.priority ?? 1,
    provinces:     (initial?.provinces ?? []) as string[],
    is_active:     initial?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  function toggleProv(p: string) {
    set("provinces", form.provinces.includes(p)
      ? form.provinces.filter(x => x !== p)
      : [...form.provinces, p]);
  }

  async function submit() {
    if (!form.advertiser_id || !form.title || !form.target_url) {
      setErr("Completa los campos obligatorios (anunciante, titulo, URL destino)");
      return;
    }
    setLoading(true); setErr("");
    try {
      await onSave({
        ...form,
        provinces: form.provinces.length ? form.provinces : null,
      });
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? "Error al guardar");
    }
    setLoading(false);
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{initial ? "Editar anuncio" : "Nuevo anuncio"}</h3>
        <button onClick={onCancel} className="text-text-muted hover:text-text-primary">
          <XCircle size={16} />
        </button>
      </div>

      {err && <p className="text-xs text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-3 py-2">{err}</p>}

      {/* Anunciante */}
      <div>
        <label className="text-xs text-text-secondary mb-1 block">Anunciante *</label>
        <select value={form.advertiser_id} onChange={e => set("advertiser_id", e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm">
          <option value="">-- Elegir --</option>
          {advertisers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Tipo + prioridad */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Tipo</label>
          <select value={form.type} onChange={e => set("type", e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm">
            <option value="banner">Banner (card en feed)</option>
            <option value="overlay">Overlay (abre in-app)</option>
            <option value="inline">Inline (pequeño)</option>
          </select>
        </div>
        <Input label="Prioridad (1-10)" type="number" min={1} max={10}
          value={String(form.priority)} onChange={e => set("priority", +e.target.value)} />
      </div>

      <Input label="Titulo *" value={form.title} onChange={e => set("title", e.target.value)} />
      <Input label="URL destino *" value={form.target_url} onChange={e => set("target_url", e.target.value)} placeholder="https://miempresa.com" />
      <Input label="Descripción" value={form.description} onChange={e => set("description", e.target.value)} />
      <Input label="Texto boton CTA" value={form.cta_text} onChange={e => set("cta_text", e.target.value)} />

      {/* Upload imagen */}
      <ImageUploader value={form.image_url} onChange={url => set("image_url", url)} />

      {/* Provincias */}
      <div>
        <label className="text-xs text-text-secondary mb-2 block">
          Provincias (vacio = nacional)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AR_PROVINCES.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => toggleProv(p)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-all ${
                form.provinces.includes(p)
                  ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple"
                  : "border-border/60 text-text-muted hover:border-accent-purple/30"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {form.provinces.length > 0 && (
          <p className="text-xs text-accent-purple mt-1">{form.provinces.length} provincia{form.provinces.length !== 1 ? "s" : ""} seleccionada{form.provinces.length !== 1 ? "s" : ""}</p>
        )}
      </div>

      {/* Activo toggle (solo en edicion) */}
      {initial && (
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            onClick={() => set("is_active", !form.is_active)}
            className={"relative w-10 h-5 rounded-full transition-colors " + (form.is_active ? "bg-accent-purple" : "bg-bg-muted border border-border")}
          >
            <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform " + (form.is_active ? "translate-x-5" : "translate-x-0.5")} />
          </button>
          <span className="text-sm text-text-secondary">{form.is_active ? "Activo" : "Inactivo"}</span>
        </label>
      )}

      <Button loading={loading} onClick={submit}>
        {initial ? "Guardar cambios" : "Crear anuncio"}
      </Button>
    </Card>
  );
}

function AdsTab() {
  const [adsList, setAdsList]       = useState<any[]>([]);
  const [advertisers, setAdvertisers] = useState<any[]>([]);
  const [stats, setStats]           = useState<any[]>([]);
  const [showNewAd, setShowNewAd]   = useState(false);
  const [showNewAdv, setShowNewAdv] = useState(false);
  const [editingAd, setEditingAd]   = useState<any | null>(null);
  const [advForm, setAdvForm] = useState({
    name: "", category: "sex_shop", website_url: "", contact_email: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const ok  = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); };
  const err = (msg: string) => { setFeedback("Error: " + msg); setTimeout(() => setFeedback(""), 4000); };

  const load = async () => {
    const [adsR, advR, statsR] = await Promise.all([
      adsApi.listAds(), adsApi.listAdvertisers(), adsApi.stats(),
    ]);
    setAdsList(adsR.data); setAdvertisers(advR.data); setStats(statsR.data);
  };
  useEffect(() => { load(); }, []);

  async function createAdvertiser() {
    if (!advForm.name) { err("El nombre es obligatorio"); return; }
    setLoading(true);
    try {
      await adsApi.createAdvertiser(advForm);
      ok("Anunciante creado");
      setShowNewAdv(false);
      setAdvForm({ name: "", category: "sex_shop", website_url: "", contact_email: "", notes: "" });
      load();
    } catch (e: any) { err(e.response?.data?.detail ?? "Error"); }
    setLoading(false);
  }

  async function handleSaveAd(body: any) {
    if (editingAd) {
      await adsApi.updateAd(editingAd.id, body);
      ok("Anuncio actualizado");
      setEditingAd(null);
    } else {
      await adsApi.createAd(body);
      ok("Anuncio creado");
      setShowNewAd(false);
    }
    load();
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <div className={"p-3 rounded-xl text-sm border " + (feedback.startsWith("Error")
          ? "bg-status-error/10 border-status-error/30 text-status-error"
          : "bg-status-success/10 border-status-success/30 text-status-success")}>
          {feedback}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-text-muted text-[10px] uppercase tracking-wide">Activos</p>
          <p className="text-2xl font-bold">{stats.filter((a: any) => a.is_active).length}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-text-muted text-[10px] uppercase tracking-wide">Impresiones</p>
          <p className="text-2xl font-bold">{stats.reduce((s: number, a: any) => s + (a.impressions || 0), 0)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-text-muted text-[10px] uppercase tracking-wide">Clicks</p>
          <p className="text-2xl font-bold">{stats.reduce((s: number, a: any) => s + (a.clicks || 0), 0)}</p>
        </Card>
      </div>

      {/* Botones */}
      {!showNewAd && !editingAd && !showNewAdv && (
        <div className="flex gap-2">
          <Button onClick={() => setShowNewAdv(v => !v)}
            className="flex-1 bg-bg-card border border-border text-text-primary hover:bg-bg-muted text-sm">
            <Plus size={14} /> Anunciante
          </Button>
          <Button onClick={() => setShowNewAd(true)} className="flex-1 text-sm">
            <Plus size={14} /> Nuevo anuncio
          </Button>
        </div>
      )}

      {/* Form anunciante */}
      {showNewAdv && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Nuevo anunciante</h3>
            <button onClick={() => setShowNewAdv(false)} className="text-text-muted"><XCircle size={15} /></button>
          </div>
          <Input label="Nombre *" value={advForm.name} onChange={e => setAdvForm(f => ({...f, name: e.target.value}))} />
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Categoría</label>
            <select value={advForm.category} onChange={e => setAdvForm(f => ({...f, category: e.target.value}))}
              className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm">
              {AD_CATEGORIES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
          <Input label="Sitio web" value={advForm.website_url} onChange={e => setAdvForm(f => ({...f, website_url: e.target.value}))} placeholder="https://..." />
          <Input label="Email contacto" value={advForm.contact_email} onChange={e => setAdvForm(f => ({...f, contact_email: e.target.value}))} />
          <Button loading={loading} onClick={createAdvertiser}>Crear anunciante</Button>
        </Card>
      )}

      {/* Form nuevo anuncio */}
      {showNewAd && (
        <AdForm advertisers={advertisers} onSave={handleSaveAd} onCancel={() => setShowNewAd(false)} />
      )}

      {/* Form editar anuncio */}
      {editingAd && (
        <AdForm advertisers={advertisers} initial={editingAd} onSave={handleSaveAd} onCancel={() => setEditingAd(null)} />
      )}

      {/* Lista anuncios */}
      {!showNewAd && !editingAd && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Anuncios ({adsList.length})</h3>
          </div>
          {adsList.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-10">
              No hay anuncios. Crea uno con el boton de arriba.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {adsList.map((ad: any) => (
                <div key={ad.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Thumbnail */}
                  <div className="w-14 h-10 rounded-lg overflow-hidden bg-bg-muted border border-border/40 flex-shrink-0">
                    {ad.image_url
                      ? <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Megaphone size={14} className="text-text-muted" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{ad.title}</p>
                    <p className="text-xs text-text-muted truncate">
                      {ad.advertiser?.name} · {ad.type} · P{ad.priority}
                    </p>
                    <p className="text-xs text-text-muted">
                      {ad.impressions || 0} imp · {ad.clicks || 0} clicks
                      {ad.impressions > 0 && " · CTR " + ((ad.clicks/ad.impressions)*100).toFixed(1) + "%"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setEditingAd(ad)}
                      className="text-xs text-accent-purple hover:underline">Editar</button>
                    <button
                      onClick={async () => { await adsApi.updateAd(ad.id, { is_active: !ad.is_active }); load(); }}
                      className={"relative w-10 h-5 rounded-full transition-colors " + (ad.is_active ? "bg-accent-purple" : "bg-bg-muted border border-border")}
                    >
                      <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform " + (ad.is_active ? "translate-x-5" : "translate-x-0.5")} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Lista anunciantes */}
      {advertisers.length > 0 && !showNewAd && !editingAd && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-sm">Anunciantes ({advertisers.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {advertisers.map((a: any) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-text-muted">{AD_CATEGORIES.find(c => c.v === a.category)?.l ?? a.category}</p>
                </div>
                {a.website_url && (
                  <a href={a.website_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-accent-purple hover:underline">Ver sitio</a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// VERIFICAR FILTRACIÓN (Fase 3)
// ============================================================
function LeakVerifierTab() {
  const [file, setFile]       = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult]   = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function verify() {
    if (!file) return;
    setLoading(true);
    try {
      const { data } = await mediaApi.verifyLeak(file);
      setResult(data);
    } catch (e: any) {
      setResult({ error: e.response?.data?.detail ?? "Error" });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <Shield size={16} className="text-accent-purple"/>
          Analizador de imágenes filtradas
        </h2>
        <p className="text-text-muted text-xs mb-4">
          Subí una imagen filtrada para extraer el watermark invisible y saber qué usuario la distribuyó.
        </p>

        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-accent-purple/50 transition-colors mb-4"
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-contain" />
          ) : (
            <div className="text-text-muted">
              <Shield size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Click para seleccionar imagen</p>
              <p className="text-xs mt-1">JPEG, PNG, WebP</p>
            </div>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

        <Button onClick={verify} loading={loading} disabled={!file}>
          Analizar watermark invisible
        </Button>
      </Card>

      {result && (
        <Card className={"p-6 border " + (result.found ? "border-status-error/30 bg-status-error/5" : "border-border")}>
          {result.error && <p className="text-status-error">{result.error}</p>}
          {result.found === false && !result.error && (
            <p className="text-text-muted text-sm">No se encontro watermark. La imagen puede ser externa o fue alterada.</p>
          )}
          {result.found && (
            <div className="space-y-3">
              <p className="font-bold text-status-error flex items-center gap-2">
                <Shield size={16}/> Watermark encontrado
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-text-muted text-xs">User ID</p>
                  <p className="font-mono text-xs break-all">{result.user_id}</p>
                </div>
                <div>
                  <p className="text-text-muted text-xs">Timestamp</p>
                  <p className="font-mono text-xs">{result.timestamp}</p>
                </div>
                {result.user_info && (
                  <div className="col-span-2 p-3 bg-status-error/10 rounded-xl">
                    <p className="text-text-muted text-xs mb-1">Usuario identificado</p>
                    <p className="font-semibold">{result.user_info.name}</p>
                    <p className="text-xs text-text-muted">{result.user_info.email}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-text-muted text-xs">Payload raw</p>
                  <p className="font-mono text-xs text-text-secondary break-all">{result.raw_payload}</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ============================================================
// AUDIT LOG
// ============================================================
function AuditTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  useEffect(() => { paymentsApi.auditLog(100).then((r) => setLogs(r.data)); }, []);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold">Log de auditoría</h2>
        <p className="text-text-muted text-xs mt-1">Últimas 100 acciones admin</p>
      </div>
      <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
        {logs.map((l) => (
          <div key={l.id} className="p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <code className="text-accent-purple font-mono text-xs">{l.action}</code>
              <span className="text-text-muted text-xs">{new Date(l.created_at).toLocaleString("es-AR")}</span>
            </div>
            {l.resource_type && (
              <p className="text-text-muted text-xs mt-1">
                {l.resource_type}: <code className="text-text-secondary">{l.resource_id}</code>
              </p>
            )}
            {l.metadata && Object.keys(l.metadata).length > 0 && (
              <pre className="text-xs text-text-muted mt-2 overflow-x-auto bg-bg-muted p-2 rounded-md">
                {JSON.stringify(l.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {logs.length === 0 && <p className="text-text-muted text-sm text-center py-8">Sin actividad</p>}
      </div>
    </Card>
  );
}

// ── Moderation Tab ────────────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  dismiss:      { label: "Desestimar",    color: "text-text-muted"    },
  warn_user:    { label: "Advertir",      color: "text-status-warning" },
  delete_post:  { label: "Borrar post",   color: "text-status-error"   },
  suspend_user: { label: "Suspender",     color: "text-status-error"   },
};

function ModerationTab() {
  const [reports,      setReports]      = useState<any[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [actioning,    setActioning]    = useState<string | null>(null);
  const [noteMap,      setNoteMap]      = useState<Record<string, string>>({});

  async function loadReports() {
    setLoading(true);
    try {
      const { data } = await moderationApi.list({ status: filterStatus || undefined, limit: 50 });
      setReports(data.reports || []);
      setPendingCount(data.pending_count || 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadReports(); }, [filterStatus]);

  async function handleAction(reportId: string, action: string) {
    setActioning(reportId + action);
    try {
      await moderationApi.action(reportId, { action, admin_note: noteMap[reportId] || "" });
      setReports(prev => prev.filter(r => r.id !== reportId));
      setPendingCount(c => action !== "dismiss" ? Math.max(0, c - 1) : Math.max(0, c - 1));
    } catch { /* ignore */ }
    setActioning(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-lg">Moderación</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-status-error/15 text-status-error text-xs font-semibold">
              {pendingCount} pendientes
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {["pending", "actioned", "dismissed", ""].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                filterStatus === s ? "border-accent-purple bg-accent-purple/10 text-accent-purple" : "border-border text-text-muted hover:border-border/80"
              }`}
            >
              {s === "" ? "Todos" : s === "pending" ? "Pendientes" : s === "actioned" ? "Accionados" : "Desestimados"}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-bg-muted rounded-2xl animate-pulse"/>)}
        </div>
      )}

      {!loading && reports.length === 0 && (
        <Card className="p-12 text-center">
          <CheckCircle size={32} className="mx-auto mb-3 text-status-success opacity-50" />
          <p className="text-text-muted">Sin reportes {filterStatus === "pending" ? "pendientes" : "en esta categoría"}</p>
        </Card>
      )}

      {!loading && reports.map(r => {
        const isPost    = r.target_type === "post";
        const targetInfo = r.target_info || {};
        const reporter  = r.reporter || {};
        const reviewer  = r.reviewer || {};

        return (
          <Card key={r.id} className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isPost ? "bg-accent-purple/15 text-accent-purple" : "bg-status-error/15 text-status-error"
                }`}>
                  {isPost ? <FileText size={14}/> : <UserX size={14}/>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {isPost ? "Post reportado" : "Usuario reportado"}
                    {" · "}
                    <span className="font-normal text-text-muted">{r.reason_label}</span>
                  </p>
                  <p className="text-[10px] text-text-muted">
                    Por: {reporter.first_name} {reporter.last_name}
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                r.status === "pending"   ? "bg-status-warning/15 text-status-warning" :
                r.status === "actioned"  ? "bg-status-success/15 text-status-success" :
                                           "bg-bg-muted text-text-muted"
              }`}>
                {r.status === "pending" ? "Pendiente" : r.status === "actioned" ? "Accionado" : "Desestimado"}
              </span>
            </div>

            {/* Target preview */}
            {isPost && (targetInfo.caption || targetInfo.media_url) && (
              <div className="bg-bg-muted rounded-xl p-3 flex items-start gap-3">
                {targetInfo.media_url && (
                  <img src={targetInfo.media_url} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0"/>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {targetInfo.caption || "Sin caption"}
                  </p>
                  {targetInfo.users && (
                    <p className="text-[10px] text-text-muted mt-1">
                      Autor: {targetInfo.users.first_name} {targetInfo.users.last_name}
                    </p>
                  )}
                </div>
              </div>
            )}
            {!isPost && (targetInfo.first_name || targetInfo.profile_photo_url) && (
              <div className="bg-bg-muted rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-card flex-shrink-0">
                  {targetInfo.profile_photo_url
                    ? <img src={targetInfo.profile_photo_url} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full bg-accent-purple/20"/>
                  }
                </div>
                <div>
                  <p className="text-sm font-medium">{targetInfo.first_name} {targetInfo.last_name}</p>
                  <p className="text-[10px] text-text-muted capitalize">{targetInfo.status || "activo"}</p>
                </div>
              </div>
            )}

            {/* Detalles del reporte */}
            {r.details && (
              <p className="text-xs text-text-muted bg-bg-muted rounded-xl px-3 py-2 italic">
                "{r.details}"
              </p>
            )}

            {/* Acciones (solo si pending) */}
            {r.status === "pending" && (
              <div className="space-y-2 pt-1">
                <input
                  value={noteMap[r.id] || ""}
                  onChange={e => setNoteMap(p => ({ ...p, [r.id]: e.target.value }))}
                  placeholder="Nota admin (opcional)…"
                  className="w-full bg-bg-muted border border-border rounded-xl px-3 py-2 text-xs outline-none focus:border-accent-purple/50"
                />
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ACTION_LABELS).map(([action, { label, color }]) => (
                    !(action === "delete_post" && !isPost) &&
                    !(action === "suspend_user" && isPost && !targetInfo.user_id) ? (
                      <button
                        key={action}
                        onClick={() => handleAction(r.id, action)}
                        disabled={!!actioning}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border border-border hover:bg-bg-muted transition-colors disabled:opacity-50 ${color}`}
                      >
                        {actioning === r.id + action ? "…" : label}
                      </button>
                    ) : null
                  ))}
                </div>
              </div>
            )}

            {/* Si fue revisado */}
            {r.status !== "pending" && r.admin_note && (
              <p className="text-[10px] text-text-muted italic">
                Nota admin: {r.admin_note} · por {reviewer.first_name} {reviewer.last_name}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

