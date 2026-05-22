export type UserRole = "miembro" | "influencer" | "socio" | "admin";

export type UserStatus =
  | "pending_email"
  | "pending_kyc"
  | "pending_manual"
  | "active"
  | "suspended"
  | "rejected";

export type MembershipType = "none" | "monthly" | "lifetime";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  membership_type: MembershipType;
  membership_expires_at: string | null;
  profile_photo_url: string | null;
  bio: string | null;
  province: string | null;
  city: string | null;
  created_at: string;
  // Identidad y preferencias
  profile_type: ProfileType | null;
  sexual_orientation: SexualOrientation | null;
  interested_in: AttractionCategory[] | null;
  visible_to: AttractionCategory[] | null;
  no_messages_from: AttractionCategory[] | null;
  identity_description: string | null;
  profile_extended: ProfileExtended | null;
  // deprecated
  hide_from_solos: boolean;
  no_messages_from_solos: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  status: UserStatus;
  role: UserRole;
}

export interface ApiError {
  detail: string;
}

export type MasterKeyType = "gratis" | "descuento" | "temporal" | "vitalicio";

export type ProfileType = "solo_h" | "solo_m" | "id_div" | "pareja" | "trio_grupo";
export type SexualOrientation = "hetero" | "gay" | "bi" | "pan" | "flexible" | "na";
export type AttractionCategory = "hombres" | "mujeres" | "id_div" | "parejas" | "grupos";
export type MemberGender = "hombre" | "mujer" | "id_div";

export interface ExtendedMember {
  gender?: MemberGender;
  orientation?: SexualOrientation;
  age?: number;
  height?: number;
  weight?: number;
}

export interface ProfileExtended {
  // id_div
  description?: string;
  orientation?: SexualOrientation;
  age?: number;
  height?: number;
  weight?: number;
  // pareja / grupo
  size?: number;
  members?: ExtendedMember[];
}

export const PROFILE_TYPE_CONFIG: Record<ProfileType, { label: string; isSolo: boolean; color: string; dot: string }> = {
  solo_h:     { label: "Hombre",              isSolo: true,  color: "text-blue-400",   dot: "bg-blue-400" },
  solo_m:     { label: "Mujer",               isSolo: true,  color: "text-pink-400",   dot: "bg-pink-400" },
  id_div:     { label: "Identidad diversa",   isSolo: true,  color: "text-violet-400", dot: "bg-violet-400" },
  pareja:     { label: "Pareja",              isSolo: false, color: "text-emerald-400",dot: "bg-emerald-400" },
  trio_grupo: { label: "Grupo",               isSolo: false, color: "text-amber-400",  dot: "bg-amber-400" },
};

export const ORIENTATION_CONFIG: Record<SexualOrientation, { label: string }> = {
  hetero:   { label: "Heterosexual" },
  gay:      { label: "Gay / Lesbiana" },
  bi:       { label: "Bisexual" },
  pan:      { label: "Pansexual" },
  flexible: { label: "Flexible" },
  na:       { label: "Prefiero no decir" },
};

export const ATTRACTION_SUGGESTIONS: Record<ProfileType, Record<SexualOrientation, AttractionCategory[]>> = {
  solo_h:     { hetero: ["mujeres","parejas"], gay: ["hombres","parejas","grupos"], bi: ["hombres","mujeres","id_div","parejas","grupos"], pan: ["hombres","mujeres","id_div","parejas","grupos"], flexible: [], na: [] },
  solo_m:     { hetero: ["hombres","parejas"], gay: ["mujeres","id_div","parejas","grupos"], bi: ["hombres","mujeres","id_div","parejas","grupos"], pan: ["hombres","mujeres","id_div","parejas","grupos"], flexible: [], na: [] },
  id_div:     { hetero: ["hombres","mujeres","parejas"], gay: ["id_div","parejas","grupos"], bi: ["hombres","mujeres","id_div","parejas","grupos"], pan: ["hombres","mujeres","id_div","parejas","grupos"], flexible: [], na: [] },
  pareja:     { hetero: [], gay: [], bi: [], pan: [], flexible: [], na: [] },
  trio_grupo: { hetero: [], gay: [], bi: [], pan: [], flexible: [], na: [] },
};

export const ATTRACTION_LABELS: Record<AttractionCategory, { label: string; desc: string }> = {
  hombres: { label: "Hombres",              desc: "Hombres cis" },
  mujeres: { label: "Mujeres",              desc: "Mujeres cis" },
  id_div:  { label: "Identidades diversas", desc: "Trans, no binaries y géneros fluidos" },
  parejas: { label: "Parejas",              desc: "Parejas de cualquier combinación" },
  grupos:  { label: "Grupos",               desc: "Tríos y grupos de hasta 4 personas" },
};

export type PlanId = "monthly" | "annual" | "lifetime";
export type PaymentCurrency = "ARS" | "USD";
export type PaymentMethod = "cash" | "transfer" | "stripe" | "mercadopago" | "crypto" | "other";

export interface Plan {
  id: PlanId;
  label: string;
  days: number | null;
  price_ars: number;
  price_usd: number;
  savings: { ars: number; pct: number } | null;
}

export interface Post {
  id: string;
  user_id: string;
  type: "photo" | "text" | "story" | "poll";
  caption?: string;
  media_url?: string;
  province?: string;
  city?: string;
  lat?: number;
  lng?: number;
  distance_km?: number;
  is_story: boolean;
  expires_at?: string;
  views_count: number;
  created_at: string;
  author: { id: string; name: string; avatar?: string; province?: string; profile_type?: string };
  reactions: Record<string, number>;
  viewer_reaction?: string;
}

export interface Story {
  user_id: string;
  name: string;
  avatar?: string;
  stories: { id: string; media_url: string; created_at: string }[];
}

export interface Review {
  id: string;
  reviewer_id: string;
  reviewed_id: string;
  rating: number;
  text?: string;
  is_anonymous: boolean;
  created_at: string;
  reviewer?: { id?: string; first_name: string; last_name: string; profile_photo_url?: string };
}

export interface ReviewStats {
  total_reviews: number;
  avg_rating: number | null;
  positive_count: number;
  medal: "none" | "bronze" | "silver" | "silver_plus" | "gold";
}

export interface PricingResponse {
  plans: Plan[];
  dolar_blue: { sell: number; buy: number; source: string; stale?: boolean };
  currency_note: string;
}

export interface Payment {
  id: string;
  user_id: string;
  amount_usd: number;
  amount_ars: number;
  exchange_rate: number;
  method: PaymentMethod;
  membership_type: "monthly" | "lifetime";
  membership_days: number;
  status: "pending" | "completed" | "refunded" | "failed";
  reference: string | null;
  notes: string | null;
  external_id: string | null;
  processed_by: string | null;
  created_at: string;
}

export interface ExchangeRate {
  buy: number;
  sell: number;
  source: string;
  fetched_at?: string;
  cached?: boolean;
  stale?: boolean;
}

export interface RevenueStats {
  total_payments: number;
  total_usd: number;
  total_ars: number;
  this_month_usd: number;
  this_month_ars: number;
  this_month_count: number;
  by_method: Record<string, { count: number; usd: number; ars: number }>;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface MasterKey {
  id: string;
  code: string;
  type: MasterKeyType;
  discount_pct: number;
  temp_days: number | null;
  max_uses: number;
  uses_count: number;
  expires_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}
