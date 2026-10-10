import { Pecha } from "@/components/ui/shadimport";
import type { useTranslate } from "@tolgee/react";
import { useNavigate } from "react-router-dom";
import defaultCover from "/default-image.webp";
import { BsThreeDotsVertical } from "react-icons/bs";
import { LuLayers } from "react-icons/lu";
import { DropdownButton } from "@/components/ui/molecules/dropdown-button/DropdownButton";
import type {
  DashboardLanguageCode,
  DashboardTableRow,
} from "./dashboardTable";
import { DASHBOARD_TABLE_ICON_BTN, isMockDashboardId } from "./dashboardTable";
import { ROUTES } from "@/routes/paths";
import { FeaturedStar, languageChip, statusChip } from "./dashboardTableUi";
import type { PlatformRole } from "@/lib/platformAccess";
import {
  canAccessPlanRoutes,
  isReviewer,
  shouldShowCmsActionsColumn,
} from "@/lib/platformAccess";
import type { AuthorGroupMemberRole } from "@/components/routes/groups/api/groupsApi";
import { canChangeContentStatus } from "@/lib/contentPermissions";
import { resolveDashboardRowGroupRole } from "@/lib/dashboardRowPermissions";
import type { UserInfo } from "@/hooks/useUserInfo";

interface DashboardContentTableProps {
  rows: DashboardTableRow[];
  isLoading?: boolean;
  t: ReturnType<typeof useTranslate>["t"];
  handleFeatured: (
    id: string,
    kind: DashboardTableRow["kind"],
    featured: boolean,
  ) => void;
  platformRole?: PlatformRole;
  /** Membership roles from the groups list API (`my_role`), keyed by group id. */
  groupRolesByGroupId?: Map<string, AuthorGroupMemberRole | undefined>;
  userInfo?: UserInfo | null;
}

export function DashboardContentTable({
  rows,
  isLoading,
  t,
  handleFeatured,
  platformRole,
  groupRolesByGroupId,
  userInfo,
}: DashboardContentTableProps) {
  const navigate = useNavigate();
  const platformReadOnly = isReviewer(platformRole);
  const showActionsColumn = shouldShowCmsActionsColumn(platformRole);
  const rolesMap = groupRolesByGroupId ?? new Map();

  const renderBody = () => {
    if (isLoading)
      return (
        <Pecha.TableRow>
          <Pecha.TableCell colSpan={6} className="text-center py-6">
            {t("studio.common.loading")}
          </Pecha.TableCell>
        </Pecha.TableRow>
      );
    return rows.map((row) => {
      const groupRole = resolveDashboardRowGroupRole(row, rolesMap, userInfo);
      const canFeature = canChangeContentStatus(groupRole, platformRole);
      const daysLabel =
        row.total_days === 1
          ? t("studio.dashboard.days_count_one", { count: row.total_days })
          : t("studio.dashboard.days_count_other", { count: row.total_days });
      const titleHref =
        row.kind === "plan" ? ROUTES.plan(row.id) : ROUTES.series(row.id);
      const canOpenTitle =
        row.kind === "series" || canAccessPlanRoutes(platformRole);

      const canToggleFeatured =
        row.kind === "series" ||
        (row.kind === "plan" && !isMockDashboardId(row.id));
      const featuredDisabled = row.status !== "PUBLISHED";
      return (
        <Pecha.TableRow
          key={`${row.kind}-${row.id}`}
          className="dark:bg-background"
        >
          <Pecha.TableCell>
            <div className="relative inline-block">
              <img
                src={row.image_url || defaultCover}
                onError={(e) => {
                  e.currentTarget.src = defaultCover;
                }}
                alt=""
                className="h-12 w-28 rounded border object-cover"
              />
              {row.kind === "series" ? (
                <span
                  className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm"
                  aria-label={t("studio.dashboard.series_plans_count_aria", {
                    count: row.plans_count ?? 0,
                  })}
                >
                  <LuLayers className="h-3 w-3 shrink-0" aria-hidden />
                  {row.plans_count ?? 0}
                </span>
              ) : null}
            </div>
          </Pecha.TableCell>
          <Pecha.TableCell>
            {canOpenTitle ? (
              <button
                type="button"
                className="text-left cursor-pointer"
                onClick={() => navigate(titleHref)}
              >
                <div className="text-sm font-semibold">{row.title}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {row.languages?.map((code: DashboardLanguageCode) => (
                    <span key={`${row.id}-${code}`}>{languageChip(code)}</span>
                  ))}
                  {statusChip(row.status, t)}
                  {row.kind === "plan" && (
                    <span className="rounded-full bg-[#DEAD2D4D] px-2.5 py-0.5 text-xs font-medium text-[#020C1D] dark:bg-[#DEAD2D4D] dark:text-white">
                      {daysLabel}
                    </span>
                  )}
                </div>
              </button>
            ) : (
              <div className="text-left">
                <div className="text-sm font-semibold">{row.title}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {row.languages?.map((code: DashboardLanguageCode) => (
                    <span key={`${row.id}-${code}`}>{languageChip(code)}</span>
                  ))}
                  {statusChip(row.status, t)}
                  {row.kind === "plan" && (
                    <span className="rounded-full bg-[#DEAD2D4D] px-2.5 py-0.5 text-xs font-medium text-[#020C1D] dark:bg-[#DEAD2D4D] dark:text-white">
                      {daysLabel}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Pecha.TableCell>
          <Pecha.TableCell className="text-sm text-center">
            {row.enrolled}
          </Pecha.TableCell>

          <Pecha.TableCell className="text-center">
            {canToggleFeatured && canFeature && !platformReadOnly ? (
              <Pecha.Button
                type="button"
                variant="outline"
                size="icon"
                className={`${DASHBOARD_TABLE_ICON_BTN} disabled:bg-[#F3F4F6] disabled:hover:bg-[#F3F4F6] dark:disabled:bg-[#2a2a2a] dark:disabled:hover:bg-[#2a2a2a]`}
                disabled={featuredDisabled}
                aria-label={
                  row.featured
                    ? t("studio.dashboard.featured")
                    : t("studio.dashboard.not_featured")
                }
                onClick={() => handleFeatured(row.id, row.kind, row.featured)}
              >
                <FeaturedStar
                  featured={row.featured}
                  disabled={featuredDisabled}
                />
              </Pecha.Button>
            ) : (
              <span
                className={`${DASHBOARD_TABLE_ICON_BTN} cursor-default`}
                aria-hidden
              >
                <FeaturedStar featured={row.featured} disabled />
              </span>
            )}
          </Pecha.TableCell>
          {showActionsColumn ? (
            <Pecha.TableCell className="px-auto">
              {row.kind === "plan" && isMockDashboardId(row.id) ? (
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
                    <Pecha.DropdownMenuItem disabled>
                      {t("studio.dashboard.preview_mock")}
                    </Pecha.DropdownMenuItem>
                  </Pecha.DropdownMenuContent>
                </Pecha.DropdownMenu>
              ) : (
                <DropdownButton
                  id={row.id}
                  entityType={row.kind}
                  currentStatus={row.status}
                  triggerVariant="icon"
                  triggerClassName={DASHBOARD_TABLE_ICON_BTN}
                  platformRole={platformRole}
                  groupRole={groupRole}
                  sourceGroupId={row.group_id}
                  contentTitle={row.title}
                />
              )}
            </Pecha.TableCell>
          ) : null}
        </Pecha.TableRow>
      );
    });
  };

  return (
    <Pecha.Table className="bg-white dark:bg-[#181818]">
      <Pecha.TableHeader className="dark:bg-[#1d1d1f]">
        <Pecha.TableRow className="font-dynamic">
          <Pecha.TableHead className="w-[120px] font-bold">
            {/* {t("studio.dashboard.cover_image")} */}
          </Pecha.TableHead>
          <Pecha.TableHead className="font-bold">
            {t("studio.dashboard.title")}
          </Pecha.TableHead>
          <Pecha.TableHead className="w-[100px] font-bold text-center">
            {t("studio.dashboard.plan_used")}
          </Pecha.TableHead>

          <Pecha.TableHead className="w-[72px] font-bold text-center">
            {t("studio.dashboard.featured")}
          </Pecha.TableHead>
          {showActionsColumn ? (
            <Pecha.TableHead className="w-[100px] font-bold text-center">
              {t("studio.dashboard.actions")}
            </Pecha.TableHead>
          ) : null}
        </Pecha.TableRow>
      </Pecha.TableHeader>
      <Pecha.TableBody>{renderBody()}</Pecha.TableBody>
    </Pecha.Table>
  );
}
