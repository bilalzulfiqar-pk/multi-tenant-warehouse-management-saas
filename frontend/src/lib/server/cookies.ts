import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const ACCESS_COOKIE = "wms_access";
export const REFRESH_COOKIE = "wms_refresh";
export const WORKSPACE_COOKIE = "wms_workspace";

export const secureCookies = process.env.NODE_ENV === "production";
const configuredCookieDomain = process.env.FRONTEND_COOKIE_DOMAIN?.trim() || "";
const normalizedCookieDomain = ["localhost", ".localhost"].includes(
  configuredCookieDomain.toLowerCase(),
)
  ? "lvh.me"
  : configuredCookieDomain;
const frontendCookieDomain = normalizedCookieDomain || undefined;

const sharedCookieOptions: Partial<ResponseCookie> = {
  ...(frontendCookieDomain ? { domain: frontendCookieDomain } : {}),
};

export const accessCookieOptions: Partial<ResponseCookie> = {
  ...sharedCookieOptions,
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookies,
  path: "/",
  maxAge: 60 * 30,
};

export const refreshCookieOptions: Partial<ResponseCookie> = {
  ...sharedCookieOptions,
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookies,
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export const workspaceCookieOptions: Partial<ResponseCookie> = {
  ...sharedCookieOptions,
  httpOnly: false,
  sameSite: "lax",
  secure: secureCookies,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export const expiredCookieOptions: Partial<ResponseCookie> = {
  ...sharedCookieOptions,
  path: "/",
  maxAge: 0,
};
