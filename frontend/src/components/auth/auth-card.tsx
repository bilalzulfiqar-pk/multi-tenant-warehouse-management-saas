import { Building2 } from "lucide-react";
import Link from "next/link";

export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="motion-page w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-emerald-300">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-slate-950">Multi-Tenant WMS</p>
            <p className="text-xs text-slate-500">Warehouse operations dashboard</p>
          </div>
        </Link>
        <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 border-t pt-4 text-center text-sm text-slate-500">
          {footer}
        </div>
      </div>
    </div>
  );
}
