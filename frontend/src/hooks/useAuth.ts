import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { authApi, twoFactorApi } from "@/lib/api";
import type { UserStatus } from "@/types";

/** Resultado del login: status normal o señal de que hay que verificar 2FA */
export type LoginResult =
  | { requires2fa: false; status: UserStatus }
  | { requires2fa: true;  totpSession: string; userId: string };

export function useAuth() {
  const store = useAuthStore();

  async function login(email: string, password: string): Promise<LoginResult> {
    const { data } = await authApi.login(email, password);

    if (data.requires_2fa && data.totp_session) {
      return { requires2fa: true, totpSession: data.totp_session, userId: data.user_id };
    }

    store.setTokens(data.access_token, data.refresh_token);
    const { data: me } = await authApi.me();
    store.setUser(me);
    return { requires2fa: false, status: data.status as UserStatus };
  }

  async function verifyTotpLogin(totpSession: string, code: string): Promise<UserStatus> {
    const { data } = await twoFactorApi.verifyLogin(totpSession, code);
    store.setTokens(data.access_token, data.refresh_token);
    const { data: me } = await authApi.me();
    store.setUser(me);
    return data.status as UserStatus;
  }

  async function logout() {
    const refresh = store.refresh_token;
    store.logout();
    if (refresh) {
      try { await authApi.logout(refresh); } catch {}
    }
  }

  async function refreshUser() {
    try {
      const { data } = await authApi.me();
      store.setUser(data);
      return data;
    } catch {
      return null;
    }
  }

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    login,
    verifyTotpLogin,
    logout,
    refreshUser,
  };
}

export function useRedirectByStatus() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!user) return;
    switch (user.status) {
      case "pending_email":
        navigate("/verificar-email");
        break;
      case "pending_kyc":
        navigate("/kyc");
        break;
      case "pending_manual":
        navigate("/aprobacion-pendiente");
        break;
      case "active":
        if (user.role === "admin") navigate("/admin");
        else navigate("/feed");
        break;
      case "suspended":
      case "rejected":
        navigate("/acceso-denegado");
        break;
    }
  }, [user, isAuthenticated, navigate]);
}
