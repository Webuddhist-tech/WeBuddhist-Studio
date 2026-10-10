import { Pecha } from "@/components/ui/shadimport";
import { FaChevronUp, FaChevronDown } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import defaultCover from "/default-image.webp";
import { DropdownButton } from "../dropdown-button/DropdownButton";
import { FaStar } from "react-icons/fa";
import type { useTranslate } from "@tolgee/react";

export interface Plan {
  id: string;
  image_url: string;
  title: string;
  description: string;
  total_days: string;
  subscription_count: string;
  status: string;
  featured: boolean;
  language: string;
}

interface DashBoardTableProps {
  plans: Plan[];
  t: ReturnType<typeof useTranslate>["t"];
  isLoading?: boolean;
  error?: { message: string };
  sortBy: string;
  sortOrder: string;
  onSort: (column: string) => void;
  handleFeatured: (id: string) => void;
}

export function DashBoardTable({
  plans,
  t,
  isLoading,
  error,
  sortBy,
  sortOrder,
  onSort,
  handleFeatured,
}: DashBoardTableProps) {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <Pecha.Badge className="bg-green-100  dark:bg-green-900 text-green-500 px-3 py-1.5 text-sm font-bold">
            {t("studio.common.published")}
          </Pecha.Badge>
        );
      case "UNPUBLISHED":
        return (
          <Pecha.Badge className="bg-red-100  dark:bg-red-900 text-red-500 px-3 py-1.5 text-sm font-bold">
            {t("studio.molecules.dashboard_table.status_unpublished")}
          </Pecha.Badge>
        );
      case "DRAFT":
        return (
          <Pecha.Badge className="px-3 py-1.5 text-sm font-bold dark:bg-pending/10 bg-[#E1F0FF] text-[#008DFF] dark:text-pending">
            {t("studio.common.draft")}
          </Pecha.Badge>
        );
      case "ARCHIVED":
        return (
          <Pecha.Badge className="px-3 py-1.5 text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {t("studio.molecules.dashboard_table.status_archived")}
          </Pecha.Badge>
        );
      default:
        return (
          <Pecha.Badge className="px-3 py-1.5 text-sm font-bold dark:bg-pending/10 bg-[#E1F0FF] text-[#008DFF] dark:text-pending">
            {t("studio.common.draft")}
          </Pecha.Badge>
        );
    }
  };

  const getLanguage = (language: string) => {
    switch (language) {
      case "EN":
        return (
          <Pecha.Badge className=" bg-amber-100 text-amber-500 dark:bg-amber-900 dark:text-amber-100 px-3 py-1.5 text-sm font-bold">
            English
          </Pecha.Badge>
        );
      case "BO":
        return (
          <Pecha.Badge className=" bg-green-100 text-green-500 dark:bg-green-900 dark:text-green-100 px-3 py-1.5 text-sm font-bold">
            བོད་ཡིག
          </Pecha.Badge>
        );
      case "ZH":
        return (
          <Pecha.Badge className=" bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-100 px-3 py-1.5 text-sm font-bold">
            中文
          </Pecha.Badge>
        );
    }
  };
  const getSortIcon = (column: string) => {
    const isActive = sortBy === column;
    const Icon = isActive && sortOrder === "asc" ? FaChevronUp : FaChevronDown;
    const colorClass = isActive
      ? "text-gray-600 dark:text-gray-400"
      : "text-gray-300 dark:text-gray-400 opacity-50";

    return <Icon size={12} className={`ml-2 ${colorClass}`} />;
  };

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell
            colSpan={6}
            className="text-center py-6 text-muted-foreground"
          >
            {t("studio.common.loading")}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }

    if (error) {
      return (
        <Pecha.TableRow>
          <Pecha.TableCell
            colSpan={6}
            className="text-center py-6 text-red-500"
          >
            {error.message}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    }

    return plans.map((plan) => (
      <Pecha.TableRow key={plan.id} className="dark:bg-background">
        <Pecha.TableCell>
          <img
            src={plan.image_url || defaultCover}
            onError={(e) => {
              e.currentTarget.src = defaultCover;
            }}
            alt={t("studio.molecules.dashboard_table.cover_image_alt")}
            className="w-32 rounded border-2 h-12 object-cover"
          />
        </Pecha.TableCell>
        <Pecha.TableCell
          className="cursor-pointer"
          onClick={() => navigate(ROUTES.plan(plan.id))}
        >
          <div className="font-semibold text-sm">{plan.title}</div>
          <div className="text-xs text-muted-foreground max-w-2xl truncate">
            {plan.description}
          </div>
        </Pecha.TableCell>
        <Pecha.TableCell>
          {t("studio.molecules.dashboard_table.days_count", {
            count: plan.total_days,
          })}
        </Pecha.TableCell>
        <Pecha.TableCell>
          {t("studio.molecules.dashboard_table.used_count", {
            count: plan.subscription_count,
          })}
        </Pecha.TableCell>
        <Pecha.TableCell>{getStatusBadge(plan.status)}</Pecha.TableCell>
        <Pecha.TableCell>{getLanguage(plan.language)}</Pecha.TableCell>
        <Pecha.TableCell>
          <div className="flex items-center gap-2">
            <Pecha.Button
              variant="outline"
              className="bg-gray-100 hover:bg-gray-200"
              disabled={plan.status !== "PUBLISHED"}
              onClick={() => handleFeatured(plan.id)}
            >
              <FaStar
                className={`${plan.featured ? "text-yellow-500" : "text-gray-500"}`}
              />{" "}
              {plan.featured
                ? t("studio.molecules.dashboard_table.featured")
                : t("studio.molecules.dashboard_table.not_featured")}
            </Pecha.Button>
          </div>
        </Pecha.TableCell>
        <Pecha.TableCell>
          <div className="flex items-center gap-2">
            <DropdownButton id={plan.id} currentStatus={plan.status} />
          </div>
        </Pecha.TableCell>
      </Pecha.TableRow>
    ));
  };
  return (
    <Pecha.Table className="bg-white dark:bg-[#181818]">
      <Pecha.TableHeader className="dark:bg-[#1d1d1f]">
        <Pecha.TableRow className="font-dynamic">
          <Pecha.TableHead className="w-[100px] font-bold">
            {t("studio.dashboard.cover_image")}
          </Pecha.TableHead>
          <Pecha.TableHead
            className="font-bold cursor-pointer"
            onClick={() => onSort("title")}
          >
            <div className="flex items-center">
              {t("studio.dashboard.title")}
              {getSortIcon("title")}
            </div>
          </Pecha.TableHead>
          <Pecha.TableHead
            className="w-[150px] font-bold cursor-pointer"
            onClick={() => onSort("total_days")}
          >
            <div className="flex items-center">
              {t("studio.dashboard.plan_days")}
              {getSortIcon("total_days")}
            </div>
          </Pecha.TableHead>
          <Pecha.TableHead className="w-[150px] font-bold">
            {t("studio.dashboard.plan_used")}
          </Pecha.TableHead>
          <Pecha.TableHead className="w-[100px] font-bold">
            {t("studio.common.status")}
          </Pecha.TableHead>
          <Pecha.TableHead className="w-[100px] font-bold">
            {t("studio.plan.form_field.language")}
          </Pecha.TableHead>
          <Pecha.TableHead className="w-[150px] font-bold">
            {t("studio.molecules.dashboard_table.feature_header")}
          </Pecha.TableHead>
          <Pecha.TableHead className="w-[150px] font-bold">
            {t("studio.dashboard.actions")}
          </Pecha.TableHead>
        </Pecha.TableRow>
      </Pecha.TableHeader>
      <Pecha.TableBody>{renderTableContent()}</Pecha.TableBody>
    </Pecha.Table>
  );
}
