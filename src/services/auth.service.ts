import api from "./axios";
import type { ApiResponse, LoginResponseData, MeResponseData } from "@/types";

export interface LoginCredentials {
  username: string;
  password: string;
}

export const authService = {
  /**
   * Authenticate user. Returns full login response data including token.
   */
  async login(credentials: LoginCredentials): Promise<LoginResponseData> {
    const { data } = await api.post<ApiResponse<LoginResponseData>>(
      "/auth/login",
      credentials,
    );
    if (!data.success) throw new Error(data.message);
    return data.data;
  },

  /**
   * Fetch currently authenticated user (used to restore session).
   */
  async me(): Promise<MeResponseData> {
    const { data } = await api.get<ApiResponse<MeResponseData>>("/auth/me");
    if (!data.success) throw new Error(data.message);
    return data.data;
  },

  /**
   * Invalidate session server-side.
   */
  async logout(): Promise<void> {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore errors on logout — we always clear local state
    }
  },
};
