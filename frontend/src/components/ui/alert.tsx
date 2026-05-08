import { cn } from "@/lib/utils";

export function Alert({
  className,
  variant = "info",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "info" | "warning" | "danger" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        variant === "info" && "border-cyan-200 bg-cyan-50 text-cyan-800",
        variant === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        variant === "danger" && "border-red-200 bg-red-50 text-red-800",
        variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
        className,
      )}
      {...props}
    />
  );
}
