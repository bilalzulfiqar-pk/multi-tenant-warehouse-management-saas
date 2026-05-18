import { headers } from "next/headers";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CanonicalHostRedirectScreen } from "@/components/layout/canonical-host-redirect-screen";
import { Providers } from "@/components/providers";
import { canonicalFrontendUrl } from "@/lib/tenant-host";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Multi-Tenant WMS",
  description: "Warehouse management SaaS dashboard for tenant-scoped inventory operations.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const host = headerStore.get("host");
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const requestUrl = `${forwardedProto || "http"}://${host || "localhost:3000"}/`;
  const canonicalUrl = canonicalFrontendUrl(requestUrl);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col bg-slate-100"
        style={{ backgroundColor: "#f1f5f9", color: "#020617" }}
      >
        {canonicalUrl ? (
          <CanonicalHostRedirectScreen />
        ) : (
          <Providers>{children}</Providers>
        )}
      </body>
    </html>
  );
}
