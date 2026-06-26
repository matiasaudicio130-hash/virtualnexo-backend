import axios from "axios";
import { API_BASE_URL } from "@/config/app";
import { toast } from "@/store/toastStore";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000, // 15s — evita requests colgados que congelan la UI
});

// Cliente separado para uploads multipart: sin Content-Type default,
// para que el browser ponga multipart/form-data; boundary=... automáticamente.
// Timeout largo (5 min) para videos.
const uploadApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300_000,
});

// Adjunta el access token automáticamente en ambos clientes
function attachToken(config: any) {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}
api.interceptors.request.use(attachToken);
uploadApi.interceptors.request.use(attachToken);

// Lock para que múltiples 401 simultáneos no disparen varios refreshes en paralelo
let refreshPromise: Promise<void> | null = null;

// Interceptor de respuesta: 401 (refresh), 429 (rate limit), 503 (server down), red caída
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // 401 — access token expirado, refrescar una sola vez
    if (status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        // Solo un refresh a la vez — los 401 siguientes esperan el mismo promise
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refresh })
            .then(({ data }) => {
              localStorage.setItem("access_token", data.access_token);
              localStorage.setItem("refresh_token", data.refresh_token);
            })
            .catch(() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("refresh_token");
              window.location.href = "/login";
            })
            .finally(() => { refreshPromise = null; });
        }
        try {
          await refreshPromise;
          const newToken = localStorage.getItem("access_token");
          if (newToken) {
            original.headers.Authorization = `Bearer ${newToken}`;
            return api(original);
          }
        } catch { /* ya está redirigiendo a /login */ }
      }
    }

    // 429 — rate limit
    if (status === 429) {
      toast.error("Demasiadas solicitudes. Esperá un momento e intentá de nuevo.");
    }

    // 503 — servidor no disponible
    if (status === 503) {
      toast.error("El servidor no está disponible en este momento. Intentá en unos minutos.");
    }

    // Sin conexión a internet
    if (!error.response && error.code === "ERR_NETWORK") {
      toast.error("Sin conexión a internet. Revisá tu red e intentá de nuevo.");
    }
    if (error.code === "ECONNABORTED") {
      toast.error("La solicitud tardó demasiado. Verificá tu conexión.");
    }

    return Promise.reject(error);
  }
);

export default api;

// Helpers tipados
export const authApi = {
  register:  (data: object)                    => api.post("/auth/register", data),
  login:     (email: string, password: string) => api.post("/auth/login", { email, password }),
  verifyEmail: (token: string)                 => api.post("/auth/verify-email", { token }),
  logout:    (refresh_token: string)           => api.post("/auth/logout", { refresh_token }),
  me:        ()                                => api.get("/auth/me"),
  heartbeat: ()                                => api.post("/auth/heartbeat"),
  setPrivacy: (is_private: boolean)            => api.patch("/auth/me/privacy", { is_private }),
};

export const twoFactorApi = {
  status:       ()                              => api.get("/2fa/status"),
  setup:        ()                              => api.post("/2fa/setup"),
  verifySetup:  (code: string)                  => api.post("/2fa/verify-setup", { code }),
  disable:      (code: string, password: string)=> api.post("/2fa/disable", { code, password }),
  verifyLogin:  (totp_session: string, code: string) =>
    api.post("/2fa/verify", { totp_session, code }),
};

export const sessionsApi = {
  list:         ()              => api.get("/sessions/"),
  revoke:       (id: string)    => api.delete(`/sessions/${id}`),
  revokeAll:    ()              => api.delete("/sessions/"),
};

export const kycApi = {
  start: () => api.post("/kyc/start"),
  status: () => api.get("/kyc/status"),
  simulate: (action: "approve" | "reject") =>
    api.post(`/kyc/simulate/${action}`),
};

export const exchangeApi = {
  dolarBlue: (force = false) => api.get(`/exchange/dolar-blue?force_refresh=${force}`),
};

export const pricingApi = {
  plans: () => api.get("/pricing/plans"),
  plan: (id: string) => api.get(`/pricing/plans/${id}`),
};

export const messagingApi = {
  conversations: () => api.get("/messages/conversations"),
  startConversation: (recipient_id: string, first_message = "") =>
    api.post("/messages/conversations/start", { recipient_id, first_message }),
  searchMessages:    (q: string, limit = 20) => api.get("/messages/search", { params: { q, limit } }),
  messageRequests:   ()                   => api.get("/messages/requests"),
  acceptRequest:     (from_id: string)    => api.post(`/messages/requests/${from_id}/accept`),
  rejectRequest:     (from_id: string)    => api.delete(`/messages/requests/${from_id}/reject`),
  getMessages: (conv_id: string, params?: object) =>
    api.get(`/messages/conversations/${conv_id}/messages`, { params }),
  sendMessage: (conv_id: string, body: object) =>
    api.post(`/messages/conversations/${conv_id}/messages`, body),
  blockUser: (conv_id: string) =>
    api.post(`/messages/conversations/${conv_id}/block`),
  unreadCount: () => api.get("/messages/unread-count"),
};

export const notificationsApi = {
  list: (unread_only = false) =>
    api.get("/notifications/", { params: { unread_only } }),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
  markConversationRead: (senderId: string) =>
    api.post(`/notifications/read-conversation/${senderId}`),
};

export const extendedProfileApi = {
  update: (body: Record<string, unknown>) => api.patch("/auth/me/extended", body),
  pinPost:   (postId: string) => api.patch("/auth/me/extended", { pinned_post_id: postId }),
  unpinPost: ()               => api.patch("/auth/me/extended", { pinned_post_id: null }),
};

export const accountApi = {
  exportData:    () => api.get("/auth/me/export", { responseType: "blob" }),
  deleteAccount: () => api.delete("/auth/me"),
};

export const profileApi = {
  updateType:    (body: object) => api.patch("/auth/me/profile-type", body),
  updateProfile: (body: object) => api.patch("/auth/me/profile-type", body),
};


export const adsApi = {
  feedAds: (type = "banner", limit = 3) =>
    api.get("/ads/feed", { params: { type, limit } }),
  recordEvent: (adId: string, action: string, extra?: object) =>
    api.post(`/ads/${adId}/event`, { action, ...extra }),
  // Admin
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadApi.post("/ads/admin/upload-image", form);
  },
  listAdvertisers: () => api.get("/ads/admin/advertisers"),
  createAdvertiser: (body: object) => api.post("/ads/admin/advertisers", body),
  listAds: (activeOnly = false) => api.get("/ads/admin/list", { params: { active_only: activeOnly } }),
  createAd: (body: object) => api.post("/ads/admin/ads", body),
  updateAd: (id: string, body: object) => api.put(`/ads/admin/ads/${id}`, body),
  stats: () => api.get("/ads/admin/stats"),
  report: (adId: string) => api.get(`/ads/admin/report/${adId}`),
};

export const travelApi = {
  plans: (province?: string) => api.get("/travel/plans", { params: province ? { province } : {} }),
  mine: () => api.get("/travel/plans/mine"),
  create: (body: object) => api.post("/travel/plans", body),
  cancel: (id: string) => api.delete(`/travel/plans/${id}`),
};

export const feedApi = {
  getFeed:      (params?: object)                => api.get("/feed/", { params }),
  getUserPosts: (userId: string, params?: { limit?: number; offset?: number; kind?: "video" }) => api.get(`/feed/user/${userId}`, { params }),
  getTagged:    (userId: string, params?: { limit?: number; offset?: number })                  => api.get(`/feed/user/${userId}/tagged`, { params }),
  getStories:   (province?: string)              => api.get("/feed/stories", { params: province ? { province } : {} }),
  createPost:   (body: object)                   => api.post("/feed/posts", body),
  // Upload directo a Supabase Storage (bypass Railway para archivos grandes)
  signedUpload:   (body: { kind: "image"|"video"; filename?: string }) =>
    api.post("/feed/posts/signed-upload", body),
  createFromStorage: (body: object) => api.post("/feed/posts/from-storage", body),
  react:        (postId: string, type: string)   => api.post(`/feed/posts/${postId}/react`, { type }),
  viewStory:    (postId: string)                 => api.post(`/feed/posts/${postId}/view`),
  deletePost:   (postId: string)                 => api.delete(`/feed/posts/${postId}`),
  savePost:     (postId: string)                 => api.post(`/feed/posts/${postId}/save`),
  getSaved:     (params?: object)                => api.get("/feed/posts/saved", { params }),
  sharePost:    (postId: string)                 => api.post(`/feed/posts/${postId}/share`),
  repost:       (postId: string, comment = "")  => api.post(`/feed/posts/${postId}/repost`, { comment }),
  unrepost:     (postId: string)                => api.delete(`/feed/posts/${postId}/repost`),
  postStats:      (postId: string)              => api.get(`/feed/posts/${postId}/stats`),
  postReactions:  (postId: string)              => api.get(`/feed/posts/${postId}/reactions`),
  votePoll:     (postId: string, optionIndex: number) => api.post(`/feed/posts/${postId}/poll-vote`, { option_index: optionIndex }),
  pollResults:  (postId: string)                 => api.get(`/feed/posts/${postId}/poll-results`),
};

export const reviewsApi = {
  forUser: (userId: string, params?: object) => api.get(`/reviews/user/${userId}`, { params }),
  myReview: (reviewedId: string) => api.get(`/reviews/my-review/${reviewedId}`),
  create: (body: object) => api.post("/reviews/", body),
  delete: (reviewId: string) => api.delete(`/reviews/${reviewId}`),
};

export const mediaApi = {
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadApi.post("/media/avatar", form);
  },
  uploadPost: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadApi.post("/media/post", form);
  },
  myUploads: () => api.get("/media/my-uploads"),
  verifyLeak: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadApi.post("/media/verify-leak", form);
  },
};

export const reportsApi = {
  monthly: (year: number, month: number) =>
    api.get(`/reports/financial/monthly/${year}/${month}`, { responseType: "blob" }),
  annual: (year: number) =>
    api.get(`/reports/financial/annual/${year}`, { responseType: "blob" }),
  preview: (year: number, month: number) =>
    api.get(`/reports/financial/preview/${year}/${month}`),
};

export const payoutsApi = {
  summary: () => api.get("/payouts/summary"),
  history: (influencer_id?: string) =>
    api.get("/payouts/history", { params: influencer_id ? { influencer_id } : {} }),
  register: (body: object) => api.post("/payouts/register", body),
  updateKeyPct: (key_code: string, payout_pct: number) =>
    api.put("/payouts/key-pct", { key_code, payout_pct }),
};

export const stripeApi = {
  config: () => api.get("/stripe/config"),
  createCheckout: (plan: string, currency: string) =>
    api.post("/stripe/create-checkout", { plan, currency }),
  simulateSuccess: (session_id: string) =>
    api.post("/stripe/simulate-success", { session_id }),
  sessionStatus: (session_id: string) =>
    api.get(`/stripe/session/${session_id}`),
};

export const paymentsApi = {
  mine: () => api.get("/payments/me"),
  createManual: (data: object) => api.post("/payments/manual", data),
  list: (params?: object) => api.get("/payments/admin/list", { params }),
  stats: () => api.get("/payments/admin/stats"),
  auditLog: (limit = 50, offset = 0) =>
    api.get(`/payments/admin/audit-log?limit=${limit}&offset=${offset}`),
};

export const settingsApi = {
  public: () => api.get("/settings/public"),
  all: () => api.get("/settings/admin"),
  update: (key: string, value: unknown) =>
    api.put(`/settings/admin/${key}`, { value }),
};

export const commentsApi = {
  list:   (postId: string)                              => api.get(`/comments/post/${postId}`),
  add:    (postId: string, content: string, parentId?: string) =>
            api.post(`/comments/post/${postId}`, { content, parent_id: parentId }),
  delete: (commentId: string)                           => api.delete(`/comments/${commentId}`),
  report: (commentId: string, reason: string)           => api.post(`/comments/${commentId}/report`, { reason }),
};

export const chatMediaApi = {
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return uploadApi.post("/messages/upload-media", form);
  },
  updateOnline: () => api.post("/messages/online"),
  getOnline: (userId: string) => api.get(`/messages/online/${userId}`),
};

export const messagingV2Api = {
  deleteMessage:    (msgId: string, forAll = false)     => api.delete(`/messages/messages/${msgId}?for_all=${forAll}`),
  reactMessage:     (msgId: string, emoji: string)      => api.post(`/messages/messages/${msgId}/react`, { emoji }),
  markViewOnce:     (msgId: string)                     => api.post(`/messages/messages/${msgId}/view`),
  setTyping:        (convId: string, isTyping: boolean) => api.post(`/messages/conversations/${convId}/typing`, { is_typing: isTyping }),
  getTyping:        (convId: string)                    => api.get(`/messages/conversations/${convId}/typing`),
  updateSettings:   (convId: string, settings: object)  => api.put(`/messages/conversations/${convId}/settings`, settings),
  clearHistory:     (convId: string)                    => api.delete(`/messages/conversations/${convId}/history`),
  editMessage:      (msgId: string, content: string)    => api.put(`/messages/messages/${msgId}`, { content }),
};

export const couplesApi = {
  status:  ()                    => api.get("/couples/me"),
  request: (targetId: string)    => api.post(`/couples/request/${targetId}`),
  accept:  (requesterId: string) => api.post(`/couples/accept/${requesterId}`),
  decline: (requesterId: string) => api.post(`/couples/decline/${requesterId}`),
  unlink:  ()                    => api.delete("/couples/unlink"),
};

export const discoveryApi = {
  updateLocation: (lat: number, lng: number) => api.post("/discovery/location", { lat, lng }),
  nearby:         (lat: number, lng: number, radius_km = 50) =>
                    api.get("/discovery/nearby", { params: { lat, lng, radius_km } }),
  suggestions:    ()                          => api.get("/discovery/suggestions"),
  byTag:          (tag: string)              => api.get("/discovery/by-tag", { params: { tag } }),
  toggleAnonymous: ()                         => api.post("/discovery/anonymous-mode"),
};

export const eventsApi = {
  list:      (params?: object)               => api.get("/events/", { params }),
  mine:      ()                              => api.get("/events/mine"),
  create:    (body: object)                  => api.post("/events/", body),
  rsvp:      (eventId: string, status: string) => api.post(`/events/${eventId}/rsvp`, { status }),
  attendees: (eventId: string)               => api.get(`/events/${eventId}/attendees`),
  delete:    (eventId: string)               => api.delete(`/events/${eventId}`),
};

export const pushApi = {
  getVapidKey:  ()                          => api.get("/push/vapid-key"),
  subscribe:    (sub: object)               => api.post("/push/subscribe", sub),
  unsubscribe:  ()                          => api.delete("/push/unsubscribe"),
};

export const highlightsApi = {
  forUser:        (userId: string)                   => api.get(`/highlights/user/${userId}`),
  mine:           ()                                 => api.get("/highlights/mine"),
  myStories:      ()                                 => api.get("/highlights/my-stories"),
  create:         (body: object)                     => api.post("/highlights/", body),
  update:         (id: string, body: object)         => api.patch(`/highlights/${id}`, body),
  delete:         (id: string)                       => api.delete(`/highlights/${id}`),
  addItems:       (id: string, story_ids: string[])  => api.post(`/highlights/${id}/items`, { story_ids }),
  removeItem:     (id: string, storyId: string)      => api.delete(`/highlights/${id}/items/${storyId}`),
  reactStory:     (storyId: string, emoji: string)   => api.post(`/highlights/stories/${storyId}/react`, { emoji }),
  storyReactions: (storyId: string)                  => api.get(`/highlights/stories/${storyId}/reactions`),
};

export const profilesApi = {
  get:      (userId: string)           => api.get(`/profiles/${userId}`),
  like:     (userId: string)           => api.post(`/profiles/${userId}/like`),
  block:    (userId: string)           => api.post(`/profiles/${userId}/block`),
  report:   (userId: string, body: object) => api.post(`/profiles/${userId}/report`, body),
  matches:  ()                         => api.get("/profiles/matches"),
  viewers:  ()                         => api.get("/profiles/viewers"),
  // Notas temporales (estilo IG "Notes")
  getNote:    (userId: string)         => api.get(`/profiles/${userId}/note`),
  setNote:    (text: string)           => api.put("/profiles/me/note", { text }),
  deleteNote: ()                       => api.delete("/profiles/me/note"),
};

export const followsApi = {
  follow:         (userId: string)    => api.post(`/follows/${userId}`),
  unfollow:       (userId: string)    => api.delete(`/follows/${userId}`),
  status:         (userId: string)    => api.get(`/follows/${userId}/status`),
  followers:      (userId: string, params?: object) => api.get(`/follows/${userId}/followers`, { params }),
  following:      (userId: string, params?: object) => api.get(`/follows/${userId}/following`, { params }),
  followingFeed:  (params?: object)   => api.get("/follows/me/feed", { params }),
  requests:       ()                  => api.get("/follows/requests"),
  acceptRequest:  (requesterId: string) => api.post(`/follows/requests/${requesterId}/accept`),
  rejectRequest:  (requesterId: string) => api.post(`/follows/requests/${requesterId}/reject`),
};

export const groupsApi = {
  list:          ()                                       => api.get("/groups/"),
  create:        (body: object)                           => api.post("/groups/", body),
  get:           (id: string)                             => api.get(`/groups/${id}`),
  update:        (id: string, body: object)               => api.patch(`/groups/${id}`, body),
  delete:        (id: string)                             => api.delete(`/groups/${id}`),
  messages:      (id: string, params?: object)            => api.get(`/groups/${id}/messages`, { params }),
  sendMessage:   (id: string, body: object)               => api.post(`/groups/${id}/messages`, body),
  addMember:     (id: string, userId: string)             => api.post(`/groups/${id}/members`, { user_id: userId }),
  removeMember:  (id: string, userId: string)             => api.delete(`/groups/${id}/members/${userId}`),
  setMemberRole: (id: string, userId: string, role: string) => api.patch(`/groups/${id}/members/${userId}/role`, { role }),
};

export const albumsApi = {
  // Username
  checkUsername:   (username: string)                 => api.get(`/albums/username/check/${username}`),
  setUsername:     (username: string)                 => api.post("/albums/username", { username }),
  // Seeking
  setSeeking:      (body: object)                     => api.post("/albums/seeking", body),
  // Albums
  listUser:        (userId: string)                   => api.get(`/albums/user/${userId}`),
  mine:            ()                                 => api.get("/albums/mine"),
  create:          (body: object)                     => api.post("/albums/", body),
  update:          (id: string, body: object)         => api.patch(`/albums/${id}`, body),
  delete:          (id: string)                       => api.delete(`/albums/${id}`),
  // Photos
  addPhoto:        (id: string, file: File)           => {
    const form = new FormData(); form.append("file", file);
    return uploadApi.post(`/albums/${id}/photos`, form);
  },
  getPhotos:       (id: string)                       => api.get(`/albums/${id}/photos`),
  deletePhoto:     (albumId: string, photoId: string) => api.delete(`/albums/${albumId}/photos/${photoId}`),
  // Access requests
  requestAccess:   (albumId: string)                  => api.post(`/albums/${albumId}/request`),
  listRequests:    (albumId: string)                  => api.get(`/albums/${albumId}/requests`),
  myRequests:      ()                                 => api.get("/albums/my-requests"),
  approve:         (albumId: string, reqId: string)   => api.post(`/albums/${albumId}/requests/${reqId}/approve`),
  reject:          (albumId: string, reqId: string)   => api.post(`/albums/${albumId}/requests/${reqId}/reject`),
  // Profile stats
  recordView:      (userId: string)                   => api.post(`/albums/profile/${userId}/view`),
  myStats:         ()                                 => api.get("/albums/profile/my-stats"),
};

export const adminApi = {
  createKey: (data: object) => api.post("/admin/keys", data),
  createKeyBatch: (data: object) => api.post("/admin/keys/batch", data),
  listKeys: (limit = 50, offset = 0) =>
    api.get(`/admin/keys?limit=${limit}&offset=${offset}`),
  deactivateKey: (id: string) => api.delete(`/admin/keys/${id}`),
  listUsers: (params?: object) => api.get("/admin/users", { params }),
  pendingManual: () => api.get("/admin/users/pending-manual"),
  approveUser: (id: string) => api.post(`/admin/users/${id}/approve`),
  suspendUser: (id: string) => api.post(`/admin/users/${id}/suspend`),
  shadowBan: (id: string) => api.post(`/admin/users/${id}/shadow-ban`),
  removeShadowBan: (id: string) => api.post(`/admin/users/${id}/unshadow-ban`),
  assignMembership: (id: string, type: string, days = 30) =>
    api.post(`/admin/users/${id}/membership`, { type, days }),
  stats: () => api.get("/admin/stats"),
};

export const searchApi = {
  search: (q: string, limit = 20) =>
    api.get("/search", { params: { q, limit } }),
};

export const analyticsApi = {
  overview: () => api.get("/analytics/overview"),
};

export const badgesApi = {
  forUser: (userId: string) => api.get(`/badges/${userId}`),
};

export const collectionsApi = {
  list:       ()                                         => api.get("/collections/"),
  create:     (name: string)                             => api.post("/collections/", { name }),
  rename:     (id: string, name: string)                 => api.patch(`/collections/${id}`, { name }),
  remove:     (id: string)                               => api.delete(`/collections/${id}`),
  addPost:    (colId: string, postId: string)            => api.post(`/collections/${colId}/posts/${postId}`),
  removePost: (colId: string, postId: string)            => api.delete(`/collections/${colId}/posts/${postId}`),
};

export const moderationApi = {
  reasons:  ()                                     => api.get("/moderation/reasons"),
  report:   (body: { target_type: "post"|"user"; target_id: string; reason: string; details?: string }) =>
    api.post("/moderation/report", body),
  list:     (params?: { status?: string; target?: string; limit?: number; offset?: number }) =>
    api.get("/moderation/reports", { params }),
  action:   (reportId: string, body: { action: string; admin_note?: string }) =>
    api.post(`/moderation/reports/${reportId}/action`, body),
};

export const hashtagsApi = {
  trending:  (days = 7, limit = 20)         => api.get("/hashtags/trending", { params: { days, limit } }),
  posts:     (tag: string, offset = 0, limit = 24) => api.get(`/hashtags/${encodeURIComponent(tag)}/posts`, { params: { offset, limit } }),
};
