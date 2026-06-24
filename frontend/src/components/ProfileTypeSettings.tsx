import { useState } from "react";
import { EyeSlash, Chat, CheckCircle, Info, Users, User, CaretDown, CaretUp, Plus, Minus } from "@phosphor-icons/react";
import { profileApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useLangStore } from "@/store/langStore";
import {
  PROFILE_TYPE_CONFIG, ORIENTATION_CONFIG, ATTRACTION_LABELS, ATTRACTION_SUGGESTIONS,
} from "@/types";
import type {
  ProfileType, SexualOrientation, AttractionCategory,
  ExtendedMember, ProfileExtended, MemberGender,
} from "@/types";

// ── Constants ────────────────────────────────────────────────
const IDENTITY_ROWS: { key: "individuals" | "diverse" | "groups"; types: ProfileType[] }[] = [
  { key: "individuals", types: ["solo_h", "solo_m"] },
  { key: "diverse",     types: ["id_div"] },
  { key: "groups",      types: ["pareja", "trio_grupo"] },
];

const ALL: AttractionCategory[] = ["hombres", "mujeres", "id_div", "parejas", "grupos"];
const ORIENTATIONS = Object.keys(ORIENTATION_CONFIG) as SexualOrientation[];
const GENDERS: MemberGender[] = ["hombre", "mujer", "id_div"];
const MAX_GROUP_SIZE = 4;

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
}

function emptyMember(): ExtendedMember { return {}; }

// ── Main component ────────────────────────────────────────────
interface Props { onSaved?: () => void }

export function ProfileTypeSettings({ onSaved }: Props) {
  const { user, refreshUser } = useAuthStore();
  const { t } = useLangStore();
  const ext = t as any; // i18n helper

  // Core fields
  const [profileType, setProfileType] = useState<ProfileType>(
    (user?.profile_type as ProfileType) ?? "solo_h"
  );
  const [orientation, setOrientation] = useState<SexualOrientation>(
    (user?.sexual_orientation as SexualOrientation) ?? "flexible"
  );
  const [interestedIn, setInterestedIn] = useState<AttractionCategory[]>(
    (user?.interested_in as AttractionCategory[]) ?? []
  );
  const [visibleTo, setVisibleTo] = useState<AttractionCategory[]>(
    (user?.visible_to as AttractionCategory[]) ?? []
  );

  // Messaging whitelist (inverted from no_messages_from)
  const blockedOnLoad = (user?.no_messages_from as AttractionCategory[]) ?? [];
  const [canMessageMe, setCanMessageMe] = useState<AttractionCategory[]>(
    blockedOnLoad.length === 0 ? [] : ALL.filter(c => !blockedOnLoad.includes(c))
  );

  // Extended profile
  const savedExt = (user?.profile_extended ?? {}) as ProfileExtended;
  const [identityDesc, setIdentityDesc] = useState(user?.identity_description ?? "");
  const [extOrientation, setExtOrientation] = useState<SexualOrientation>(
    savedExt.orientation ?? "flexible"
  );
  const [extAge, setExtAge]       = useState<string>(savedExt.age?.toString() ?? "");
  const [extHeight, setExtHeight] = useState<string>(savedExt.height?.toString() ?? "");
  const [extWeight, setExtWeight] = useState<string>(savedExt.weight?.toString() ?? "");

  // Group/couple members
  const initMembers = savedExt.members ?? [];
  const [members, setMembers] = useState<ExtendedMember[]>(
    initMembers.length > 0 ? initMembers : [emptyMember(), emptyMember()]
  );
  const [groupSize, setGroupSize] = useState<number>(
    savedExt.size ?? (profileType === "trio_grupo" ? 3 : 2)
  );

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    extended: true,
    feed: false,
    visibility: false,
    messages: false,
  });

  const isSolo  = PROFILE_TYPE_CONFIG[profileType].isSolo;
  const isGroup = profileType === "pareja" || profileType === "trio_grupo";
  const isIdDiv = profileType === "id_div";

  function toggleSection(key: string) {
    setOpenSections(s => ({ ...s, [key]: !s[key] }));
  }

  function handleTypeChange(type: ProfileType) {
    setProfileType(type);
    if (type === "pareja") setGroupSize(2);
    if (type === "trio_grupo") setGroupSize(3);
  }

  function handleOrientationChange(o: SexualOrientation) {
    setOrientation(o);
    const suggestions = (ATTRACTION_SUGGESTIONS[profileType]?.[o] ?? [])
      .filter(s => ALL.includes(s as AttractionCategory)) as AttractionCategory[];
    if (suggestions.length > 0) {
      setInterestedIn(suggestions);
      setSuggested(true);
      setTimeout(() => setSuggested(false), 2200);
    }
  }

  function updateMember(idx: number, field: keyof ExtendedMember, value: any) {
    setMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value || undefined } : m));
  }

  function handleGroupSizeChange(size: number) {
    setGroupSize(size);
    setMembers(prev => {
      const next = [...prev];
      while (next.length < size) next.push(emptyMember());
      return next.slice(0, size);
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const noMsgFrom = canMessageMe.length === 0
        ? null
        : ALL.filter(c => !canMessageMe.includes(c));

      let profile_extended: ProfileExtended | null = null;

      if (isIdDiv) {
        profile_extended = {
          orientation: extOrientation !== "flexible" ? extOrientation : undefined,
          age:    extAge    ? parseInt(extAge)    : undefined,
          height: extHeight ? parseInt(extHeight) : undefined,
          weight: extWeight ? parseInt(extWeight) : undefined,
        };
      } else if (isGroup) {
        const cleanMembers = members.slice(0, groupSize).map(m => ({
          gender:      m.gender      ?? undefined,
          orientation: m.orientation ?? undefined,
          age:         m.age         ?? undefined,
          height:      m.height      ?? undefined,
          weight:      m.weight      ?? undefined,
        }));
        profile_extended = { size: groupSize, members: cleanMembers };
      }

      await profileApi.updateType({
        profile_type:         profileType,
        sexual_orientation:   isSolo && !isIdDiv ? orientation : undefined,
        interested_in:        interestedIn.length > 0 ? interestedIn : null,
        visible_to:           visibleTo.length > 0 ? visibleTo : null,
        no_messages_from:     noMsgFrom && noMsgFrom.length > 0 ? noMsgFrom : null,
        identity_description: isIdDiv ? (identityDesc || null) : null,
        profile_extended:     profile_extended,
      });

      await refreshUser?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="space-y-3">

      {/* ── 1. IDENTIDAD ──────────────────────────────────── */}
      <div>
        <p className="text-xs text-text-muted uppercase tracking-widest mb-3 font-medium">{ext.profile.identity}</p>
        <div className="space-y-2">
          {IDENTITY_ROWS.map(({ key, types }) => (
            <div key={key}>
              <p className="text-[10px] text-text-muted/60 uppercase tracking-widest mb-1.5 ml-0.5">
                {ext.profile[key]}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {types.map(type => {
                  const cfg = PROFILE_TYPE_CONFIG[type];
                  const active = profileType === type;
                  return (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
                        active
                          ? "border-accent-purple/60 bg-accent-purple/8 shadow-glow"
                          : "border-border/60 bg-bg-muted/50 hover:border-accent-purple/30"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <p className={`text-xs font-medium leading-tight truncate ${active ? "text-accent-purple" : "text-text-secondary"}`}>
                        {ext.profileTypes[type]}
                      </p>
                      {active && <CheckCircle size={12} className="text-accent-purple ml-auto flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. ORIENTACIÓN (solo_h / solo_m) ────────────── */}
      {isSolo && !isIdDiv && (
        <Accordion
          title={ext.profile.orientation}
          open={openSections.orientation}
          onToggle={() => toggleSection("orientation")}
        >
          <p className="text-xs text-text-muted mb-3">{ext.profile.orientationDesc}</p>
          <OrientationGrid
            value={orientation}
            onChange={handleOrientationChange}
            t={ext}
          />
          {suggested && (
            <p className="text-xs text-accent-purple mt-2 animate-fade-in">
              {ext.profile.suggestionApplied}
            </p>
          )}
        </Accordion>
      )}

      {/* ── 3. IDENTIDADES DIVERSAS (extended) ───────────── */}
      {isIdDiv && (
        <Accordion
          title={ext.extended.identityDescription}
          open={openSections.extended}
          onToggle={() => toggleSection("extended")}
        >
          <div className="space-y-4">
            <textarea
              value={identityDesc}
              onChange={e => setIdentityDesc(e.target.value)}
              placeholder={ext.extended.identityPlaceholder}
              rows={2}
              className="w-full bg-bg-muted/60 border border-border/60 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-purple/50 transition-colors"
            />
            <div>
              <p className="text-xs text-text-muted mb-2 uppercase tracking-widest">{ext.extended.orientation}</p>
              <OrientationGrid value={extOrientation} onChange={setExtOrientation} t={ext} />
            </div>
            <OptionalFields
              age={extAge} height={extHeight} weight={extWeight}
              onAge={setExtAge} onHeight={setExtHeight} onWeight={setExtWeight}
              t={ext}
            />
          </div>
        </Accordion>
      )}

      {/* ── 4. PAREJA — miembros ─────────────────────────── */}
      {profileType === "pareja" && (
        <Accordion
          title="Integrantes de la pareja"
          open={openSections.extended}
          onToggle={() => toggleSection("extended")}
        >
          <div className="space-y-4">
            {[0, 1].map(idx => (
              <MemberCard
                key={idx}
                index={idx}
                member={members[idx] ?? emptyMember()}
                onChange={(f, v) => updateMember(idx, f, v)}
                t={ext}
              />
            ))}
          </div>
        </Accordion>
      )}

      {/* ── 5. GRUPO — miembros ──────────────────────────── */}
      {profileType === "trio_grupo" && (
        <Accordion
          title="Integrantes del grupo"
          open={openSections.extended}
          onToggle={() => toggleSection("extended")}
        >
          <div className="space-y-4">
            {/* Selector cantidad */}
            <div>
              <p className="text-xs text-text-muted mb-2 uppercase tracking-widest">{ext.extended.groupSize}</p>
              <div className="flex gap-2">
                {[2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => handleGroupSizeChange(n)}
                    className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                      groupSize === n
                        ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple"
                        : "border-border/60 bg-bg-muted/50 text-text-muted hover:border-accent-purple/30"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            {/* Tarjetas de miembros */}
            {Array.from({ length: groupSize }, (_, idx) => (
              <MemberCard
                key={idx}
                index={idx}
                member={members[idx] ?? emptyMember()}
                onChange={(f, v) => updateMember(idx, f, v)}
                t={ext}
              />
            ))}
          </div>
        </Accordion>
      )}

      {/* ── 6. QUÉ QUERÉS VER ────────────────────────────── */}
      <Accordion
        title={ext.profile.feedFilter}
        open={openSections.feed}
        onToggle={() => toggleSection("feed")}
      >
        <p className="text-xs text-text-muted mb-3">{ext.profile.feedFilterDesc}</p>
        <AttractionList selected={interestedIn} onToggle={c => setInterestedIn(toggle(interestedIn, c))} t={ext} />
        <StatusLine selected={interestedIn} emptyText={ext.profile.feedEmpty} activePrefix={null} t={ext} color="muted" />
        {suggested && <p className="text-xs text-accent-purple mt-1 animate-fade-in">{ext.profile.suggestionApplied}</p>}
      </Accordion>

      {/* ── 7. QUIÉN PUEDE VERTE ─────────────────────────── */}
      <Accordion
        title={ext.profile.whoSeesYou}
        icon={<EyeSlash size={13} className="text-accent-purple flex-shrink-0" />}
        open={openSections.visibility}
        onToggle={() => toggleSection("visibility")}
      >
        <p className="text-xs text-text-muted mb-3">{ext.profile.whoSeesYouDesc}</p>
        <AttractionList selected={visibleTo} onToggle={c => setVisibleTo(toggle(visibleTo, c))} t={ext} />
        <StatusLine selected={visibleTo} emptyText={ext.profile.whoSeesEmpty} activePrefix={ext.profile.whoSeesActive} t={ext} color="accent" />
      </Accordion>

      {/* ── 8. MENSAJES ENTRANTES ────────────────────────── */}
      <Accordion
        title={ext.profile.whoMessages}
        icon={<Chat size={13} className="text-accent-purple flex-shrink-0" />}
        open={openSections.messages}
        onToggle={() => toggleSection("messages")}
      >
        <p className="text-xs text-text-muted mb-3">{ext.profile.whoMessagesDesc}</p>
        <AttractionList selected={canMessageMe} onToggle={c => setCanMessageMe(toggle(canMessageMe, c))} t={ext} />
        <StatusLine selected={canMessageMe} emptyText={ext.profile.whoMessagesEmpty} activePrefix={ext.profile.whoMessagesActive} t={ext} color="accent" />
      </Accordion>

      {/* ── INFO ─────────────────────────────────────────── */}
      <div className="flex gap-2.5 px-4 py-3 bg-bg-muted/40 rounded-xl border border-border/40 text-xs text-text-muted">
        <Info size={13} className="flex-shrink-0 mt-0.5 text-accent-purple/50" />
        <p>{ext.profile.info}</p>
      </div>

      {/* ── GUARDAR ─────────────────────────────────────── */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-3 rounded-xl font-semibold text-sm tracking-wide transition-all duration-200 ${
          saved
            ? "bg-status-success/90 text-white"
            : "bg-accent-purple text-white hover:opacity-90 active:scale-[.99] disabled:opacity-50"
        }`}
      >
        {saved ? ext.common.saved : saving ? ext.common.saving : ext.common.save}
      </button>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function Accordion({
  title, icon, open, onToggle, children,
}: {
  title: string; icon?: React.ReactNode;
  open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-muted/30 hover:bg-bg-muted/50 transition-colors text-left"
      >
        <span className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-text-primary">{title}</span>
        </span>
        {open ? <CaretUp size={15} className="text-text-muted flex-shrink-0" /> : <CaretDown size={15} className="text-text-muted flex-shrink-0" />}
      </button>
      {open && <div className="px-4 py-4">{children}</div>}
    </div>
  );
}

function OrientationGrid({ value, onChange, t }: {
  value: SexualOrientation; onChange: (o: SexualOrientation) => void; t: any;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {ORIENTATIONS.map(key => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all duration-150 ${
              active
                ? "border-accent-purple/60 bg-accent-purple/8 text-accent-purple"
                : "border-border/60 bg-bg-muted/50 text-text-muted hover:border-accent-purple/30"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? "bg-accent-purple" : "bg-text-muted"}`} />
            <span className="text-xs font-medium">{t.orientations[key]}</span>
            {active && <CheckCircle size={11} className="ml-auto flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function OptionalFields({ age, height, weight, onAge, onHeight, onWeight, t }: {
  age: string; height: string; weight: string;
  onAge: (v: string) => void; onHeight: (v: string) => void; onWeight: (v: string) => void;
  t: any;
}) {
  return (
    <div>
      <p className="text-xs text-text-muted mb-2 uppercase tracking-widest">{t.extended.optionalData}</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t.extended.age,    value: age,    onChange: onAge,    max: 99,   placeholder: "Ej: 28" },
          { label: t.extended.height, value: height, onChange: onHeight, max: 250,  placeholder: "Ej: 170" },
          { label: t.extended.weight, value: weight, onChange: onWeight, max: 300,  placeholder: "Ej: 65" },
        ].map(({ label, value, onChange, max, placeholder }) => (
          <div key={label}>
            <p className="text-[10px] text-text-muted mb-1">{label}</p>
            <input
              type="number"
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              min={0}
              max={max}
              className="w-full bg-bg-muted/60 border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent-purple/50 transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberCard({ index, member, onChange, t }: {
  index: number; member: ExtendedMember;
  onChange: (field: keyof ExtendedMember, value: any) => void;
  t: any;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-bg-muted/20 hover:bg-bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <User size={13} className="text-accent-purple/60" />
          <span className="text-xs font-medium text-text-secondary">
            {t.extended.member} {index + 1}
            {member.gender && (
              <span className="ml-2 text-text-muted font-normal">
                · {t.extended.genders[member.gender]}
              </span>
            )}
          </span>
        </span>
        {open ? <CaretUp size={13} className="text-text-muted" /> : <CaretDown size={13} className="text-text-muted" />}
      </button>
      {open && (
        <div className="px-3 py-3 space-y-3">
          {/* Género */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">{t.extended.gender}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {GENDERS.map(g => (
                <button
                  key={g}
                  onClick={() => onChange("gender", member.gender === g ? undefined : g)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                    member.gender === g
                      ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple"
                      : "border-border/60 bg-bg-muted/40 text-text-muted hover:border-accent-purple/30"
                  }`}
                >
                  {t.extended.genders[g]}
                </button>
              ))}
            </div>
          </div>
          {/* Orientación */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">{t.extended.orientation}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ORIENTATIONS.map(o => (
                <button
                  key={o}
                  onClick={() => onChange("orientation", member.orientation === o ? undefined : o)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs transition-all ${
                    member.orientation === o
                      ? "border-accent-purple/60 bg-accent-purple/8 text-accent-purple"
                      : "border-border/60 bg-bg-muted/40 text-text-muted hover:border-accent-purple/30"
                  }`}
                >
                  <span className={`w-1 h-1 rounded-full flex-shrink-0 ${member.orientation === o ? "bg-accent-purple" : "bg-text-muted"}`} />
                  {t.orientations[o]}
                </button>
              ))}
            </div>
          </div>
          {/* Datos opcionales */}
          <OptionalFields
            age={member.age?.toString() ?? ""}
            height={member.height?.toString() ?? ""}
            weight={member.weight?.toString() ?? ""}
            onAge={v    => onChange("age",    v ? parseInt(v) : undefined)}
            onHeight={v => onChange("height", v ? parseInt(v) : undefined)}
            onWeight={v => onChange("weight", v ? parseInt(v) : undefined)}
            t={t}
          />
        </div>
      )}
    </div>
  );
}

function AttractionList({ selected, onToggle, t }: {
  selected: AttractionCategory[]; onToggle: (c: AttractionCategory) => void; t: any;
}) {
  return (
    <div className="grid grid-cols-1 gap-1.5">
      {ALL.map(cat => {
        const active = selected.includes(cat);
        return (
          <button
            key={cat}
            onClick={() => onToggle(cat)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-150 ${
              active
                ? "border-accent-purple/50 bg-accent-purple/6"
                : "border-border/60 bg-bg-muted/40 hover:border-accent-purple/25"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${active ? "text-accent-purple" : "text-text-secondary"}`}>
                {t.attractions[cat].label}
              </p>
              <p className="text-[11px] text-text-muted">{t.attractions[cat].desc}</p>
            </div>
            <div className={`w-4 h-4 rounded-md border-[1.5px] flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
              active ? "bg-accent-purple border-accent-purple" : "border-border"
            }`}>
              {active && <CheckCircle size={9} className="text-bg-base" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function StatusLine({ selected, emptyText, activePrefix, t, color }: {
  selected: AttractionCategory[]; emptyText: string;
  activePrefix: string | null; t: any; color: "muted" | "accent";
}) {
  if (selected.length === 0) return <p className="text-xs text-text-muted mt-2">{emptyText}</p>;
  const names = selected.map(c => t.attractions[c].label).join(", ");
  return (
    <p className={`text-xs mt-2 ${color === "accent" ? "text-accent-purple" : "text-text-muted"}`}>
      {activePrefix ? `${activePrefix} ${names}.` : names}
    </p>
  );
}
