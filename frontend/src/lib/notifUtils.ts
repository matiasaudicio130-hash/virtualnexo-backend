export interface NotifData {
  sender_id?: string;
  post_id?: string;
  actor_id?: string;
  matched_user_id?: string;
  conversation_id?: string;
  [key: string]: string | undefined;
}

export interface NotifItem {
  type: string;
  data?: NotifData;
}

/**
 * Devuelve la ruta de navegación para una notificación dada.
 * null = no hay destino específico (no navegar).
 */
export function getNotifUrl(n: NotifItem): string | null {
  switch (n.type) {
    case "new_message":
      return n.data?.sender_id ? `/messages?with=${n.data.sender_id}` : "/messages";
    case "new_reaction":
    case "new_like":
    case "like":
      return n.data?.post_id ? `/feed?post=${n.data.post_id}` : "/feed";
    case "comment":
    case "comment_reply":
      return n.data?.post_id ? `/feed?post=${n.data.post_id}` : "/feed";
    case "new_follower":
      return n.data?.actor_id ? `/profile/${n.data.actor_id}` : null;
    case "match":
      return n.data?.matched_user_id ? `/profile/${n.data.matched_user_id}` : null;
    case "new_review":
      return "/reviews";
    default:
      return null;
  }
}
