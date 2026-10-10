import * as React from "react";
import { FaAngleLeft, FaAngleRight, FaEllipsis } from "react-icons/fa6";
import { useTranslate } from "@tolgee/react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/atoms/button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  const { t } = useTranslate();
  return (
    <nav
      role="navigation"
      aria-label={t("studio.ui.pagination.label")}
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex flex-row items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"a">;

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      className={cn(
        buttonVariants({
          variant: isActive ? "outline" : "ghost",
          size,
        }),
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  const { t } = useTranslate();
  return (
    <PaginationLink
      aria-label={t("studio.ui.pagination.previous_page")}
      size="default"
      className={cn(
        "gap-1 border dark:bg-[#232323] rounded-lg px-2.5 sm:pl-2.5",
        className,
      )}
      {...props}
    >
      <span className="hidden sm:block">{t("studio.common.previous")}</span>
      <span className="sm:hidden">
        <FaAngleLeft className="size-4" />
      </span>
    </PaginationLink>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  const { t } = useTranslate();
  return (
    <PaginationLink
      aria-label={t("studio.ui.pagination.next_page")}
      size="default"
      className={cn(
        "gap-1 px-2.5 border rounded-lg dark:bg-[#232323] sm:pr-2.5",
        className,
      )}
      {...props}
    >
      <span className="hidden sm:block">{t("studio.common.next")}</span>
      <span className="sm:hidden">
        <FaAngleRight className="size-4" />
      </span>
    </PaginationLink>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const { t } = useTranslate();
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn("flex size-9 items-center justify-center", className)}
      {...props}
    >
      <FaEllipsis className="size-4" />
      <span className="sr-only">{t("studio.ui.pagination.more_pages")}</span>
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
};
