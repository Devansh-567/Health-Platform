import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/auth.api";
import { refreshAccessToken, setAccessToken, setTokenRefreshHandler } from "../api/client";
import { AuthUser } from "../types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  hasPermission: (...anyOf: string[]) => boolean;
  hasRole: (...roles: string[]) => boolean;
  /** Re-fetches /auth/me — used after actions like a password change that
   *  flip a server-side flag (mustChangePassword) the client needs to see
   *  immediately, without forcing a full reload. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((token: string | null, u: AuthUser | null, perms: string[]) => {
    setAccessToken(token);
    setUser(u);
    setPermissions(perms);
  }, []);

  // On mount: try to silently restore a session from the httpOnly refresh cookie.
  useEffect(() => {
    (async () => {
      const token = await refreshAccessToken();
      if (token) {
        try {
          const me = await authApi.me();
          applySession(token, me.data?.user ?? null, me.data?.permissions ?? []);
        } catch {
          applySession(null, null, []);
        }
      }
      setIsLoading(false);
    })();

    setTokenRefreshHandler((token) => setAccessToken(token));
  }, [applySession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const data = res.data!;
    applySession(data.accessToken, data.user, []);
    const me = await authApi.me();
    setPermissions(me.data?.permissions ?? []);
    return data.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => undefined);
    applySession(null, null, []);
  }, [applySession]);

  const refreshUser = useCallback(async () => {
    const me = await authApi.me();
    setUser(me.data?.user ?? null);
    setPermissions(me.data?.permissions ?? []);
  }, []);

  const hasPermission = useCallback((...anyOf: string[]) => anyOf.some((p) => permissions.includes(p)), [permissions]);
  const hasRole = useCallback((...roles: string[]) => !!user && roles.includes(user.role), [user]);

  const value = useMemo(
    () => ({ user, permissions, isLoading, isAuthenticated: !!user, login, logout, hasPermission, hasRole, refreshUser }),
    [user, permissions, isLoading, login, logout, hasPermission, hasRole, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
