import { afterEach, describe, expect, it } from "vitest";

import {
  buildTenantHost,
  buildTenantUrl,
  canonicalFrontendUrl,
  getTenantSubdomainFromHost,
} from "@/lib/tenant-host";

describe("tenant host helpers", () => {
  const originalBaseDomain = process.env.NEXT_PUBLIC_FRONTEND_BASE_DOMAIN;

  afterEach(() => {
    if (originalBaseDomain === undefined) {
      delete process.env.NEXT_PUBLIC_FRONTEND_BASE_DOMAIN;
    } else {
      process.env.NEXT_PUBLIC_FRONTEND_BASE_DOMAIN = originalBaseDomain;
    }
  });

  it("extracts local tenant subdomains", () => {
    expect(getTenantSubdomainFromHost("pakmart.localhost:3000")).toBe("pakmart");
    expect(getTenantSubdomainFromHost("localhost:3000")).toBeNull();
  });

  it("builds local tenant hosts from root and tenant hosts", () => {
    expect(buildTenantHost("acme", "localhost:3000")).toBe("acme.localhost:3000");
    expect(buildTenantHost("acme", "pakmart.localhost:3000")).toBe("acme.localhost:3000");
  });

  it("builds tenant dashboard URLs without carrying old query state", () => {
    expect(buildTenantUrl("acme", "http://pakmart.localhost:3000/products?page=2")).toBe(
      "http://acme.localhost:3000/dashboard",
    );
  });

  it("uses the configured local frontend base domain for shared cookies", () => {
    process.env.NEXT_PUBLIC_FRONTEND_BASE_DOMAIN = "lvh.me";

    expect(buildTenantHost("acme", "pakmart.localhost:3000")).toBe("acme.lvh.me:3000");
    expect(buildTenantUrl("acme", "http://pakmart.localhost:3000/products?page=2")).toBe(
      "http://acme.lvh.me:3000/dashboard",
    );
  });

  it("canonicalizes localhost page URLs to the shared local domain", () => {
    process.env.NEXT_PUBLIC_FRONTEND_BASE_DOMAIN = "lvh.me";

    expect(canonicalFrontendUrl("http://pakmart.localhost:3000/login")).toBe(
      "http://pakmart.lvh.me:3000/login",
    );
    expect(canonicalFrontendUrl("http://localhost:3000/login")).toBe(
      "http://lvh.me:3000/login",
    );
    expect(canonicalFrontendUrl("http://pakmart.lvh.me:3000/login")).toBeNull();
  });
});
