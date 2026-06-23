import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronRight } from "lucide-react";
import { discoveryApi } from "@/lib/api";
import { PROFILE_TYPE_CONFIG } from "@/types";
import { imgUrl } from "@/utils/image";
import type { ProfileType } from "@/types";

interface NearbyUser {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo_url?: string;
  profile_type?: string;
  city?: string;
  distance_km: number;
}

interface Props { lat: number; lng: number; }

export function NearbyUsers({ lat, lng }: Props) {
  const navigate            = useNavigate();
  const [users, setUsers]   = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    discoveryApi.nearby(lat, lng, 50)
      .then(r => setUsers(r.data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lat, lng]);

  if (loading) return (
    <div className="px-4 py-3">
      <div className="flex gap-3 overflow-x-auto">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-bg-muted animate-pulse"/>
            <div className="w-12 h-2 bg-bg-muted rounded animate-pulse"/>
          </div>
        ))}
      </div>
    </div>
  );

  if (users.length === 0) return null;

  return (
    <div className="border-b border-border/40">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <MapPin size={13} className="text-accent-purple"/>
          <span className="text-xs font-semibold text-text-primary tracking-wide">Cerca tuyo</span>
          <span className="text-[10px] text-text-muted ml-1">{users.length} {users.length === 1 ? "persona" : "personas"}</span>
        </div>
        <button
          onClick={() => navigate("/explore?tab=personas")}
          className="text-[10px] text-accent-purple flex items-center gap-0.5 hover:underline"
        >
          Ver más <ChevronRight size={11}/>
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto px-4 pb-3 scrollbar-none">
        {users.map(u => {
          const cfg = u.profile_type ? PROFILE_TYPE_CONFIG[u.profile_type as ProfileType] : null;
          return (
            <button
              key={u.id}
              onClick={() => navigate(`/profile/${u.id}`)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-accent-purple/30 group-hover:border-accent-purple/60 transition-colors">
                  {u.profile_photo_url
                    ? <img src={imgUrl(u.profile_photo_url, "avatar-md")} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async"/>
                    : <div className="w-full h-full bg-accent-purple/10 flex items-center justify-center text-accent-purple text-lg font-light">
                        {u.first_name.charAt(0)}
                      </div>
                  }
                </div>
                {/* Profile type dot */}
                {cfg && (
                  <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-bg-base ${cfg.dot}`}/>
                )}
              </div>

              <div className="text-center">
                <p className="text-[11px] text-text-primary font-medium truncate max-w-[60px]">
                  {u.first_name}
                </p>
                <p className="text-[10px] text-accent-purple">
                  {u.distance_km < 1 ? "<1 km" : `${u.distance_km} km`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
