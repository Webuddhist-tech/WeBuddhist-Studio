import { Pecha } from "@/components/ui/shadimport";
import React from "react";
import { useTranslate } from "@tolgee/react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}) => {
  const { t } = useTranslate();
  return (
    <div
      role="navigation"
      aria-label={t("studio.shell.pagination_aria")}
      className={"flex p-4 w-full items-center justify-between " + className}
    >
      <div className="text-sm text-muted-foreground">
        {t("studio.common.page_of", {
          page: currentPage,
          total: totalPages,
        })}
      </div>
      <div className="flex items-center space-x-2">
        <Pecha.PaginationPrevious
          onClick={(e) => {
            e.preventDefault();
            onPageChange(Math.max(1, currentPage - 1));
          }}
          className={
            currentPage === 1
              ? "pointer-events-none opacity-50"
              : "cursor-pointer"
          }
        />

        <Pecha.PaginationNext
          onClick={(e) => {
            e.preventDefault();
            onPageChange(Math.min(totalPages, currentPage + 1));
          }}
          className={
            currentPage === totalPages
              ? "pointer-events-none opacity-50"
              : "cursor-pointer"
          }
        />
      </div>
    </div>
  );
};
