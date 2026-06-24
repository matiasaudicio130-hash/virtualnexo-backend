import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkle } from "@phosphor-icons/react";
import { discoveryApi } from "@/lib/api";
import { PROFILE_TYPE_CONFIG } from "@/types";
import { imgUrl } from "@/utils/image";
import { AuraCheckBadge } from "@/components/ui/AuraCheckBadge";
import type { ProfileType } from "@/types";

interface SuggestedUser {
  id:                string;
  first_name:        string;
  last_name:         string;
  profile_photo_url?: string;
  profile_type?:     string;
  province?:         string;
  city?:             string;
  bio?:              string;
  seeking_tags?:     string[];
  username?:         string;
}

interface Props {
  tag?: string;
}

export function ProfileSuggestions({ tag }: Props = {}) {
  const navigate              = useNavigate();
  const [users, setUsers]     = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    setUsers([]);
    const req = tag
      ? discoveryApi.byTag(tag)
      : discoveryApi.suggestions();
    req
      .then(r => setUsers((r.data.users || []).slice(0, tag ? 20 : 8)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tag]);

  const visible = users.filter(u => !dismissed.has(u.id));

  if (loading) return (
    <div className="px-4 pt-3 pb-1 space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
          <div className="w-11 h-11 rounded-full bg-bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded-full bg-bg-muted" />
            <div className="h-2 w-16 rounded-full bg-bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );

  if (visible.length === 0) return (
    <div className="mx-4 my-3 py-6 text-center">
      <p className="text-xs text-text-muted">
        {tag ? "Nadie tiene este interés todavía. ¡Sé el primero!" : "No hay sugerencias por ahora. Completá tu perfil para aparecer en Explorar."}
      </p>
    </div>
  );

  return (
    <div className="mx-4 my-3 bg-bg-card border border-border/50 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <Sparkle size={14} className="text-accent-purple"/>
        <span className="text-xs font-semibold text-text-primary">
          {tag ? `${visible.length} persona${visible.length !== 1 ? "s" : ""} con este interés` : "Quizás te interese"}
        </span>
      </div>

      <div className="divide-y divide-border/40">
        {visible.slice(0, tag ? 20 : 4).map(u => {
          const cfg = u.profile_type ? PROFILE_TYPE_CONFIG[u.profile_type as ProfileType] : null;
          const displayName = u.username ? `@${u.username}` : `${u.first_name} ${u.last_name}`;
          return (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => navigate(`/profile/${u.id}`)} className="flex-shrink-0 relative">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-border/50">
                  {u.profile_photo_url
                    ? <img src={imgUrl(u.profile_photo_url, "avatar-md")} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async"/>
                    : <div className="w-full h-full bg-accent-purple/10 flex items-center justify-center text-accent-purple font-light">
                        {u.first_name.charAt(0)}
                      </div>
                  }
                </div>
                <AuraCheckBadge lastActiveAt={(u as any).last_active_at} size={10} offset={1} />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => navigate(`/profile/${u.id}`)}
                    className="text-sm font-medium text-text-primary truncate hover:text-accent-purple transition-colors"
                  >
                    {displayName}
                  </button>
                  {cfg && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`}/>}
                </div>
                <p className="text-[11px] text-text-muted truncate">
                  {u.bio?.slice(0, 45) || [u.city, u.province].filter(Boolean).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate(`/profile/${u.id}`)}
                  className="text-[11px] px-3 py-1.5 bg-accent-purple text-white rounded-lg hover:opacity-90 transition-all"
                >
                  Ver perfil
                </button>
                <button
                  onClick={() => setDismissed(prev => new Set([...prev, u.id]))}
                  className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
