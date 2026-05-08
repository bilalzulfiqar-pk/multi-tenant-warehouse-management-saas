import { Button } from "@/components/ui/button";
import type { Paginated } from "@/lib/types";

export function PaginationControls<T>({
  page,
  setPage,
  data,
}: {
  page: number;
  setPage: (page: number) => void;
  data?: Paginated<T>;
}) {
  const total = data?.count || 0;
  const start = total === 0 ? 0 : (page - 1) * 20 + 1;
  const end = Math.min(page * 20, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm text-slate-500 sm:flex-row">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.previous}
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!data?.next}
          onClick={() => setPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
