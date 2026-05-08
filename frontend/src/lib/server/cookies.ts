import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const ACCESS_COOKIE = "wms_access";
export const REFRESH_COOKIE = "wms_refresh";
export const WORKSPACE_COOKIE = "wms_workspace";

export const secureCookies = process.env.NODE_ENV === "production";

export const accessCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookies,
  path: "/",
  maxAge: 60 * 30,
};

export const refreshCookieOptions: Partial<ResponseCookie> = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookies,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export const workspaceCookieOptions: Partial<ResponseCookie> = {
  httpOnly: false,
  sameSite: "lax",
  secure: secureCookies,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export const expiredCookieOptions: Partial<ResponseCookie> = {
  path: "/",
  maxAge: 0,
};
