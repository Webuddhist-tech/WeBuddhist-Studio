import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslate } from "@tolgee/react";
import { format, subDays, startOfMonth, endOfMonth, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IoCalendarClearOutline, IoPeopleOutline } from "react-icons/io5";
import { HiOutlineUserPlus } from "react-icons/hi2";
import { MdOutlineTrendingUp } from "react-icons/md";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { useUserInfo } from "@/hooks/useUserInfo";
import { useDashboardGroupFilterOptions } from "@/hooks/useDashboardGroupFilterOptions";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { cn } from "@/lib/utils";
import {
  fetchAnalyticsOverview,
  type AnalyticsTopPlan,
} from "@/components/routes/analytics/analyticsApi";

type DatePreset = "7d" | "30d" | "90d" | "month" | "custom";

const PRESETS: { id: Exclude<DatePreset, "custom">; labelKey: string }[] = [
  { id: "7d", labelKey: "studio.analytics.preset.7d" },
  { id: "30d", labelKey: "studio.analytics.preset.30d" },
  { id: "90d", labelKey: "studio.analytics.preset.90d" },
  { id: "month", labelKey: "studio.analytics.preset.month" },
];

const CHART_TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e5e5e5",
  background: "#ffffff",
};

function rangeForPreset(
  preset: Exclude<DatePreset, "custom">,
  today = new Date(),
): DateRange {
  if (preset === "month") {
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }
  const days = preset === "7d" ? 6 : preset === "90d" ? 89 : 29;
  return { from: subDays(today, days), to: today };
}

function toApiDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function formatAxisDate(value: string): string {
  try {
    return format(parseISO(value), "MMM d");
  } catch {
    return value;
  }
}

function formatRangeLabel(range: DateRange, emptyLabel: string): string {
  if (range.from && range.to) {
    return `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`;
  }
  if (range.from) {
    return format(range.from, "MMM d, yyyy");
  }
  return emptyLabel;
}

function resolveApiDates(range: DateRange): {
  startDate: string | null;
  endDate: string | null;
} {
  if (!range.from) {
    return { startDate: null, endDate: null };
  }
  const startDate = toApiDate(range.from);
  const endDate = toApiDate(range.to ?? range.from);
  return { startDate, endDate };
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: Readonly<{
  label: string;
  value: number | string;
  hint?: string;
  icon: ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-muted/60 p-2.5 text-foreground/80">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

function TopPlansTable({ plans }: Readonly<{ plans: AnalyticsTopPlan[] }>) {
  const { t } = useTranslate();
  if (plans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          {t("studio.analytics.top_plans.empty_title")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("studio.analytics.top_plans.empty_description")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">
          {t("studio.analytics.top_plans.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("studio.analytics.top_plans.description")}
        </p>
      </div>
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead className="w-12">#</Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.analytics.top_plans.col_plan")}
            </Pecha.TableHead>
            <Pecha.TableHead>
              {t("studio.analytics.top_plans.col_series")}
            </Pecha.TableHead>
            <Pecha.TableHead className="text-right">
              {t("studio.analytics.joins")}
            </Pecha.TableHead>
            <Pecha.TableHead className="text-right">
              {t("studio.analytics.top_plans.col_completed")}
            </Pecha.TableHead>
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <Pecha.TableBody>
          {plans.map((plan, index) => (
            <Pecha.TableRow key={plan.id}>
              <Pecha.TableCell className="text-muted-foreground">
                {index + 1}
              </Pecha.TableCell>
              <Pecha.TableCell className="font-medium">
                {plan.title}
              </Pecha.TableCell>
              <Pecha.TableCell className="text-muted-foreground">
                {plan.series_name ?? "—"}
              </Pecha.TableCell>
              <Pecha.TableCell className="text-right tabular-nums">
                {plan.join_count.toLocaleString()}
              </Pecha.TableCell>
              <Pecha.TableCell className="text-right tabular-nums">
                {plan.completion_count.toLocaleString()}
              </Pecha.TableCell>
            </Pecha.TableRow>
          ))}
        </Pecha.TableBody>
      </Pecha.Table>
    </div>
  );
}

const Analytics = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const { options: groupOptions, isLoading: isGroupFilterLoading } =
    useDashboardGroupFilterOptions(userInfo);

  const [preset, setPreset] = useState<DatePreset>("30d");
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("30d"));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [groupId, setGroupId] = useState<string>("all");

  const { startDate, endDate } = resolveApiDates(range);
  const dateLabel = formatRangeLabel(range, t("studio.analytics.select_dates"));

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["analytics-overview", startDate, endDate, groupId],
    queryFn: () =>
      fetchAnalyticsOverview({
        start_date: startDate!,
        end_date: endDate!,
        ...(groupId !== "all" ? { group_id: groupId } : {}),
        top_limit: 10,
      }),
    enabled: Boolean(startDate && endDate),
    staleTime: 60_000,
  });

  const chartData = useMemo(
    () =>
      (data?.timeline ?? []).map((point) => ({
        ...point,
        label: formatAxisDate(point.date),
      })),
    [data?.timeline],
  );

  const applyPreset = (next: Exclude<DatePreset, "custom">) => {
    setPreset(next);
    setRange(rangeForPreset(next));
  };

  const totalUsers = data?.users.total_users ?? (isLoading ? "—" : 0);
  const newUsersThisMonth =
    data?.users.new_users_this_month ?? (isLoading ? "—" : 0);
  const newUsersInRange =
    data?.users.new_users_in_range ?? (isLoading ? "—" : 0);

  return (
    <div className="min-h-full bg-background px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("studio.analytics.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("studio.analytics.subtitle")}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap gap-1 rounded-full border border-border bg-muted/40 p-1">
              {PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyPreset(item.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    preset === item.id
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(item.labelKey)}
                </button>
              ))}
            </div>

            <Pecha.Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <Pecha.PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start gap-2 font-normal"
                  onClick={() => setPreset("custom")}
                >
                  <IoCalendarClearOutline className="h-4 w-4 text-muted-foreground" />
                  {dateLabel}
                </Button>
              </Pecha.PopoverTrigger>
              <Pecha.PopoverContent className="w-auto p-0" align="end">
                <Pecha.Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={range}
                  defaultMonth={range.from}
                  onSelect={(next) => {
                    setPreset("custom");
                    setRange(next ?? { from: undefined, to: undefined });
                  }}
                  disabled={{ after: new Date() }}
                />
              </Pecha.PopoverContent>
            </Pecha.Popover>

            {groupOptions.length > 0 ? (
              <Pecha.Select
                value={groupId}
                onValueChange={setGroupId}
                disabled={isGroupFilterLoading}
              >
                <Pecha.SelectTrigger className="w-[220px]">
                  <Pecha.SelectValue
                    placeholder={t("studio.analytics.all_groups")}
                  />
                </Pecha.SelectTrigger>
                <Pecha.SelectContent>
                  <Pecha.SelectItem value="all">
                    {t("studio.analytics.all_groups")}
                  </Pecha.SelectItem>
                  {groupOptions.map((group) => (
                    <Pecha.SelectItem key={group.id} value={group.id}>
                      {group.label}
                    </Pecha.SelectItem>
                  ))}
                </Pecha.SelectContent>
              </Pecha.Select>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {getApiErrorMessage(error)}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label={t("studio.analytics.stats.total_users")}
            value={totalUsers}
            hint={t("studio.analytics.stats.total_users_hint")}
            icon={<IoPeopleOutline className="h-5 w-5" />}
          />
          <StatCard
            label={t("studio.analytics.stats.new_users_month")}
            value={newUsersThisMonth}
            hint={t("studio.analytics.stats.new_users_month_hint")}
            icon={<HiOutlineUserPlus className="h-5 w-5" />}
          />
          <StatCard
            label={t("studio.analytics.stats.new_users_range")}
            value={newUsersInRange}
            hint={dateLabel}
            icon={<MdOutlineTrendingUp className="h-5 w-5" />}
          />
        </div>

        <div
          className={cn(
            "grid gap-4 xl:grid-cols-2",
            isFetching && "opacity-80 transition-opacity",
          )}
        >
          <ChartPanel
            title={t("studio.analytics.charts.user_growth_title")}
            description={t("studio.analytics.charts.user_growth_description")}
          >
            {isLoading ? (
              <Pecha.Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#171717"
                        stopOpacity={0.22}
                      />
                      <stop
                        offset="100%"
                        stopColor="#171717"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e5e5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tick={{ fontSize: 12, fill: "#737373" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tick={{ fontSize: 12, fill: "#737373" }}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area
                    type="monotone"
                    dataKey="new_users"
                    name={t("studio.analytics.charts.new_users")}
                    stroke="#171717"
                    fill="url(#usersFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>

          <ChartPanel
            title={t("studio.analytics.charts.joins_title")}
            description={t("studio.analytics.charts.joins_description")}
          >
            {isLoading ? (
              <Pecha.Skeleton className="h-full w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e5e5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    tick={{ fontSize: 12, fill: "#737373" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tick={{ fontSize: 12, fill: "#737373" }}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend />
                  <Bar
                    dataKey="joins"
                    name={t("studio.analytics.joins")}
                    fill="#525252"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                  <Bar
                    dataKey="completions"
                    name={t("studio.analytics.charts.completions")}
                    fill="#a3a3a3"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>
        </div>

        {isLoading ? (
          <Pecha.Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <TopPlansTable plans={data?.top_plans ?? []} />
        )}
      </div>
    </div>
  );
};

export default Analytics;
