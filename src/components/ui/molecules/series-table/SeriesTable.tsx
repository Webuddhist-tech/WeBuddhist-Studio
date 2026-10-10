import { Pecha } from "@/components/ui/shadimport";
import { useState } from "react";
import { useTranslate } from "@tolgee/react";
import { FaChevronDown, FaChevronRight } from "react-icons/fa6";
import { BsThreeDotsVertical } from "react-icons/bs";
import { IoMdTrash } from "react-icons/io";
import PlanDeleteDialog from "@/components/ui/molecules/modals/plan-delete/PlanDeleteDialog";

export interface SeriesPlanSummary {
  id: string;
  title: string;
}

export interface SeriesRow {
  id: string;
  title: string;
  total_days: number;
  enrolled: number;
  status: "PUBLISHED" | "UNPUBLISHED" | "DRAFT" | "ARCHIVED";
  language: string;
  featured: boolean;
  plans: SeriesPlanSummary[];
}

interface SeriesTableProps {
  series: SeriesRow[];
  isLoading?: boolean;
  error?: any;
  onDeleteSeries: (seriesId: string) => void;
}

function StatusDot({ status }: { status: SeriesRow["status"] }) {
  const color =
    status === "PUBLISHED"
      ? "bg-green-500"
      : status === "UNPUBLISHED"
        ? "bg-red-500"
        : status === "ARCHIVED"
          ? "bg-gray-500"
          : "bg-sky-500";

  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;
}

export function SeriesTable({
  series,
  isLoading,
  error,
  onDeleteSeries,
}: SeriesTableProps) {
  const { t } = useTranslate();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const renderBody = () => {
    if (isLoading) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell colSpan={7} className="text-center py-6">
            {t("studio.common.loading")}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }

    if (error) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell
            colSpan={7}
            className="text-center py-6 text-red-500"
          >
            {error.message}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }

    if (series.length === 0) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell
            colSpan={7}
            className="text-center py-6 text-muted-foreground"
          >
            {t("studio.molecules.series_table.empty")}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }

    return series.flatMap((s) => {
      const isOpen = !!expanded[s.id];
      const Chevron = isOpen ? FaChevronDown : FaChevronRight;

      return [
        <Pecha.TableRow key={s.id} className="dark:bg-background">
          <Pecha.TableCell className="w-[44px]">
            <Pecha.Button
              variant="ghost"
              size="icon"
              onClick={() => toggleRow(s.id)}
              aria-label={
                isOpen
                  ? t("studio.molecules.series_table.collapse_row")
                  : t("studio.molecules.series_table.expand_row")
              }
            >
              <Chevron size={14} />
            </Pecha.Button>
          </Pecha.TableCell>
          <Pecha.TableCell className="font-semibold text-sm">
            {s.title}
          </Pecha.TableCell>
          <Pecha.TableCell>
            {t("studio.molecules.dashboard_table.days_count", {
              count: s.total_days,
            })}
          </Pecha.TableCell>
          <Pecha.TableCell>{s.enrolled}</Pecha.TableCell>
          <Pecha.TableCell>
            <StatusDot status={s.status} />
          </Pecha.TableCell>
          <Pecha.TableCell>{s.language || "-"}</Pecha.TableCell>
          <Pecha.TableCell>
            {s.featured ? t("studio.common.yes") : t("studio.common.no")}
          </Pecha.TableCell>
          <Pecha.TableCell className="w-[120px]">
            <Pecha.DropdownMenu>
              <Pecha.DropdownMenuTrigger asChild>
                <Pecha.Button
                  variant="outline"
                  size="icon"
                  aria-label={t("studio.common.actions")}
                >
                  <BsThreeDotsVertical />
                </Pecha.Button>
              </Pecha.DropdownMenuTrigger>
              <Pecha.DropdownMenuContent
                align="end"
                className="[--radius:1rem]"
              >
                <PlanDeleteDialog
                  id={s.id}
                  entityLabel="Series"
                  onDelete={onDeleteSeries}
                  trigger={
                    <Pecha.DropdownMenuItem
                      variant="destructive"
                      onSelect={(e) => e.preventDefault()}
                    >
                      <span className="flex items-center gap-2 w-full">
                        <IoMdTrash className="h-4 w-4" />
                        {t("studio.molecules.series_table.delete_series")}
                      </span>
                    </Pecha.DropdownMenuItem>
                  }
                />
              </Pecha.DropdownMenuContent>
            </Pecha.DropdownMenu>
          </Pecha.TableCell>
        </Pecha.TableRow>,
        isOpen ? (
          <Pecha.TableRow
            key={`${s.id}__expanded`}
            className="dark:bg-background"
          >
            <Pecha.TableCell />
            <Pecha.TableCell colSpan={7} className="py-3">
              <div className="text-sm">
                <div className="font-semibold mb-2">
                  {t("studio.molecules.series_table.plans_in_series")}
                </div>
                {s.plans.length === 0 ? (
                  <div className="text-muted-foreground">
                    {t("studio.molecules.series_table.no_plans")}
                  </div>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {s.plans.map((p) => (
                      <li key={p.id}>{p.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            </Pecha.TableCell>
          </Pecha.TableRow>
        ) : null,
      ].filter(Boolean) as any;
    });
  };

  return (
    <Pecha.Table className="bg-white dark:bg-[#181818]">
      <Pecha.TableHeader className="dark:bg-[#1d1d1f]">
        <Pecha.TableRow className="font-dynamic">
          <Pecha.TableHead className="w-[44px]" />
          <Pecha.TableHead className="font-bold">
            {t("studio.common.title")}
          </Pecha.TableHead>
          <Pecha.TableHead className="font-bold">
            {t("studio.molecules.series_table.days_header")}
          </Pecha.TableHead>
          <Pecha.TableHead className="font-bold">
            {t("studio.molecules.series_table.enrolled_header")}
          </Pecha.TableHead>
          <Pecha.TableHead className="font-bold">
            {t("studio.common.status")}
          </Pecha.TableHead>
          <Pecha.TableHead className="font-bold">
            {t("studio.common.language")}
          </Pecha.TableHead>
          <Pecha.TableHead className="font-bold">
            {t("studio.molecules.dashboard_table.featured")}
          </Pecha.TableHead>
          <Pecha.TableHead className="font-bold">
            {t("studio.common.actions")}
          </Pecha.TableHead>
        </Pecha.TableRow>
      </Pecha.TableHeader>
      <Pecha.TableBody>{renderBody()}</Pecha.TableBody>
    </Pecha.Table>
  );
}
