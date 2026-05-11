const LOCAL_ROOT_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
const LOCAL_WILDCARD_SUFFIXES = ["localhost", "lvh.me", "localtest.me"];

function frontendBaseDomain() {
  const configured =
    process.env.NEXT_PUBLIC_FRONTEND_BASE_DOMAIN?.trim() ||
    process.env.FRONTEND_BASE_DOMAIN?.trim() ||
    process.env.FRONTEND_COOKIE_DOMAIN?.trim() ||
    "";

  if (["localhost", ".localhost"].includes(configured.toLowerCase())) {
    return "lvh.me";
  }

  return configured;
}

function parseHost(host: string) {
  const normalized = host.replace(/^https?:\/\//, "").split("/")[0];
  const url = new URL(`http://${normalized}`);
  return {
    hostname: url.hostname.toLowerCase(),
    port: url.port,
  };
}

function hostWithPort(hostname: string, port: string) {
  return port ? `${hostname}:${port}` : hostname;
}

function localSuffixFor(hostname: string) {
  if (LOCAL_ROOT_HOSTS.has(hostname)) {
    return "localhost";
  }
  return LOCAL_WILDCARD_SUFFIXES.find(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

function tenantHostForDomain(subdomain: string | null, domain: string, port: string) {
  const hostname = subdomain ? `${subdomain}.${domain}` : domain;
  return hostWithPort(hostname, port);
}

export function getTenantSubdomainFromHost(host: string | null) {
  if (!host) {
    return null;
  }

  try {
    const { hostname } = parseHost(host);
    if (LOCAL_ROOT_HOSTS.has(hostname) || hostname === "www") {
      return null;
    }

    for (const suffix of LOCAL_WILDCARD_SUFFIXES) {
      if (hostname.endsWith(`.${suffix}`)) {
        const subdomain = hostname.slice(0, -`.${suffix}`.length).split(".")[0];
        return subdomain && subdomain !== "www" ? subdomain : null;
      }
    }

    const labels = hostname.split(".");
    if (labels.length >= 3 && labels[0] !== "www") {
      return labels[0];
    }
  } catch {
    return null;
  }

  return null;
}

export function buildTenantHost(subdomain: string, currentHost: string) {
  const { hostname, port } = parseHost(currentHost);
  const localSuffix = localSuffixFor(hostname);
  const baseDomain = frontendBaseDomain();

  if (baseDomain && localSuffix) {
    return tenantHostForDomain(subdomain, baseDomain, port);
  }

  if (LOCAL_ROOT_HOSTS.has(hostname) || hostname.endsWith(".localhost")) {
    return tenantHostForDomain(subdomain, "localhost", port);
  }

  for (const suffix of LOCAL_WILDCARD_SUFFIXES.filter((item) => item !== "localhost")) {
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) {
      return hostWithPort(`${subdomain}.${suffix}`, port);
    }
  }

  const labels = hostname.split(".");
  const rootDomain =
    labels.length >= 3 && labels[0] !== "www"
      ? labels.slice(1).join(".")
      : hostname.replace(/^www\./, "");

  return hostWithPort(`${subdomain}.${rootDomain}`, port);
}

export function buildTenantUrl(subdomain: string, currentUrl: string, path = "/dashboard") {
  const url = new URL(currentUrl);
  url.host = buildTenantHost(subdomain, url.host);
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function canonicalFrontendUrl(currentUrl: string) {
  const baseDomain = frontendBaseDomain();
  if (!baseDomain) {
    return null;
  }

  const url = new URL(currentUrl);
  const { hostname, port } = parseHost(url.host);
  const localSuffix = localSuffixFor(hostname);
  if (!localSuffix || localSuffix === baseDomain) {
    return null;
  }

  const subdomain = getTenantSubdomainFromHost(url.host);
  url.host = tenantHostForDomain(subdomain, baseDomain, port);
  return url.toString();
}
