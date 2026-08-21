import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

let accessToken: string | null = null;
let onTokenRefreshed: ((token: string | null) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Auth context registers itself here so the interceptor can update React state on refresh. */
export function setTokenRefreshHandler(handler: (token: string | null) => void) {
  onTokenRefreshed = handler;
}

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // sends the httpOnly refresh-token cookie
});

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
    const newToken = res.data?.data?.accessToken ?? null;
    accessToken = newToken;
    onTokenRefreshed?.(newToken);
    return newToken;
  } catch {
    accessToken = null;
    onTokenRefreshed?.(null);
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const code = (error.response?.data as any)?.code;

    const isAuthEndpoint = original?.url?.includes("/auth/login") || original?.url?.includes("/auth/refresh");

    if (status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      if (!refreshPromise) refreshPromise = refreshAccessToken().finally(() => (refreshPromise = null));
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as any).Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    return Promise.reject({ status, code, message: (error.response?.data as any)?.message ?? error.message });
  }
);

export { refreshAccessToken };
