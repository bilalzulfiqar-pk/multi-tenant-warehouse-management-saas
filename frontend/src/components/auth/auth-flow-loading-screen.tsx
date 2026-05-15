import { Loader2 } from "lucide-react";

export function AuthFlowLoadingScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="motion-page w-full max-w-sm rounded-lg border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
