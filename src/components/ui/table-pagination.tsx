import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Comentário: paginação padrão, visual discreto, reutilizada em todas as listagens administrativas.
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export interface TablePaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  itemLabel = "registros",
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(total, currentPage * pageSize);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="tabular-nums">
        {total === 0 ? `0 ${itemLabel}` : `Mostrando ${start}–${end} de ${total} ${itemLabel}`}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span>Por página</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-7 w-[72px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)} className="text-xs">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Anterior
          </Button>
          <span className="px-2 tabular-nums">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Próxima <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Comentário: hook utilitário que mantém página válida quando o total muda (busca/filtro/exclusão).
export function usePagination<T>(items: T[], initialPageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedItems = React.useMemo(() => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize, totalPages]);

  const handlePageSizeChange = React.useCallback((size: number) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const resetToFirstPage = React.useCallback(() => setPage(1), []);

  return {
    page,
    pageSize,
    total,
    paginatedItems,
    setPage,
    setPageSize: handlePageSizeChange,
    resetToFirstPage,
  };
}
