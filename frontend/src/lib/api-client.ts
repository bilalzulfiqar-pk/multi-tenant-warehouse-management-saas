import type { BusinessError, Paginated } from "@/lib/types";

export class ApiClientError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;

  constructor(message: string, status: number, code = "request_failed", details = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isBusinessError(value: unknown): value is BusinessError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as BusinessError).error?.message === "string"
  );
}

export function parseApiErrorBody(body: unknown, fallback: string) {
  if (isBusinessError(body)) {
    return {
      code: body.error.code || "request_failed",
      message: body.error.message || fallback,
      details: body.error.details || {},
    };
  }

  if (typeof body === "object" && body !== null) {
    const firstValue = Object.values(body)[0];
    if (Array.isArray(firstValue) && firstValue.length > 0) {
      return {
        code: "validation_error",
        message: String(firstValue[0]),
        details: body as Record<string, unknown>,
      };
    }
  }

  return { code: "request_failed", message: fallback, details: {} };
}

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean | null | undefined>;
};

function makeUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path, window.location.origin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return `${url.pathname}${url.search}`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;
  if (hasBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(makeUrl(path, options.query), {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const parsed = parseApiErrorBody(body, response.statusText || "Request failed");
    throw new ApiClientError(parsed.message, response.status, parsed.code, parsed.details);
  }

  return body as T;
}

export function globalApi<T>(path: string, options?: RequestOptions) {
  return apiRequest<T>(`/api/global/${path.replace(/^\/+/, "")}`, options);
}

export function tenantApi<T>(path: string, options?: RequestOptions) {
  return apiRequest<T>(`/api/tenant/${path.replace(/^\/+/, "")}`, options);
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value);
}

export function emptyPage<T>(): Paginated<T> {
  return { count: 0, next: null, previous: null, results: [] };
}
