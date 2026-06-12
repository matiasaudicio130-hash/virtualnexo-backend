import { describe, it, expect } from "vitest";
import { getNotifUrl } from "@/lib/notifUtils";

describe("getNotifUrl — navegación desde notificaciones", () => {

  // ── BUG que se detecta: click en notif de mensaje no llevaba al chat ────────
  it("new_message con sender_id navega a /messages?with=ID", () => {
    expect(getNotifUrl({ type: "new_message", data: { sender_id: "abc-123" } }))
      .toBe("/messages?with=abc-123");
  });

  it("new_message sin sender_id navega a /messages como fallback", () => {
    expect(getNotifUrl({ type: "new_message" })).toBe("/messages");
  });

  // ── BUG que se detecta: like/reaction no llevaba al post específico ─────────
  it("new_reaction con post_id navega a /feed?post=ID", () => {
    expect(getNotifUrl({ type: "new_reaction", data: { post_id: "post-42" } }))
      .toBe("/feed?post=post-42");
  });

  it("new_like con post_id navega a /feed?post=ID", () => {
    expect(getNotifUrl({ type: "new_like", data: { post_id: "post-99" } }))
      .toBe("/feed?post=post-99");
  });

  it("like (legacy) con post_id navega a /feed?post=ID", () => {
    expect(getNotifUrl({ type: "like", data: { post_id: "post-7" } }))
      .toBe("/feed?post=post-7");
  });

  it("new_reaction sin post_id usa /feed como fallback", () => {
    expect(getNotifUrl({ type: "new_reaction" })).toBe("/feed");
  });

  // ── Comentarios ────────────────────────────────────────────────────────────
  it("comment con post_id navega al post específico", () => {
    expect(getNotifUrl({ type: "comment", data: { post_id: "post-5" } }))
      .toBe("/feed?post=post-5");
  });

  // ── Seguidores y matches ───────────────────────────────────────────────────
  it("new_follower navega al perfil del actor", () => {
    expect(getNotifUrl({ type: "new_follower", data: { actor_id: "user-77" } }))
      .toBe("/profile/user-77");
  });

  it("new_follower sin actor_id devuelve null (no navegar)", () => {
    expect(getNotifUrl({ type: "new_follower" })).toBeNull();
  });

  it("match navega al perfil del match", () => {
    expect(getNotifUrl({ type: "match", data: { matched_user_id: "user-55" } }))
      .toBe("/profile/user-55");
  });

  it("new_review navega a /reviews", () => {
    expect(getNotifUrl({ type: "new_review" })).toBe("/reviews");
  });

  it("tipo desconocido devuelve null", () => {
    expect(getNotifUrl({ type: "kyc_approved" })).toBeNull();
  });
});
