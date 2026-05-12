import { AlertCircle, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

export function TableEmptyRow({
  colSpan,
  title,
  description,
}: {
  colSpan: number;
  title: string;
  description?: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan}>
        <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
          <Inbox className="h-7 w-7 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function TableErrorRow({
  colSpan,
  message = "This data could not be loaded.",
  onRetry,
}: {
  colSpan: number;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan}>
        <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
          <AlertCircle className="h-7 w-7 text-red-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900">Unable to load data</p>
          <p className="mt-1 text-sm text-slate-500">{message}</p>
          {onRetry ? (
            <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
