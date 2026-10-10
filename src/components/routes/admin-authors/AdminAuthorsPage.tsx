import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IoMdClose, IoMdSearch } from "react-icons/io";
import { useDebounce } from "use-debounce";
import { toast } from "sonner";
import { useTranslate } from "@tolgee/react";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { useUserInfo, USER_INFO_QUERY_KEY } from "@/hooks/useUserInfo";
import {
  canAccessAdminAuthors,
  isSuperAdmin,
  type PlatformRole,
} from "@/lib/platformAccess";
import { Navigate } from "react-router-dom";
import { ROUTES } from "@/routes/paths";
import {
  activateAuthor,
  fetchAdminAuthors,
  patchAuthorPlatformRole,
  suspendAuthor,
  type AdminAuthorDTO,
} from "./api/adminAuthorsApi";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const ROLE_OPTIONS: PlatformRole[] = [
  "CREATOR",
  "CONTENT_ADMIN",
  "REVIEWER",
  "SUPER_ADMIN",
];

const AdminAuthorsPage = () => {
  const { t } = useTranslate();
  const { data: userInfo } = useUserInfo();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [activationQueue, setActivationQueue] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);
  const [roleFilter, setRoleFilter] = useState<PlatformRole | "">("");
  // Looking someone up means looking through every author, not just the ones
  // waiting for activation, so a search or a role filter takes over from the
  // queue view.
  const inQueueView =
    activationQueue && debouncedSearch === "" && roleFilter === "";

  const canAccess = Boolean(
    userInfo && canAccessAdminAuthors(userInfo.platform_role),
  );
  const writeEnabled = isSuperAdmin(userInfo?.platform_role);
  const showActionsColumn = writeEnabled;
  const tableColumnCount = showActionsColumn ? 6 : 5;

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-authors", page, inQueueView, debouncedSearch, roleFilter],
    queryFn: () =>
      fetchAdminAuthors({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(inQueueView ? { is_verified: true, is_active: false } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(roleFilter ? { platform_role: roleFilter } : {}),
      }),
    enabled: canAccess,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-authors"] });
    queryClient.invalidateQueries({ queryKey: USER_INFO_QUERY_KEY });
  };

  const activateMutation = useMutation({
    mutationFn: activateAuthor,
    onSuccess: () => {
      toast.success(t("studio.admin_authors.toast.activated"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const suspendMutation = useMutation({
    mutationFn: suspendAuthor,
    onSuccess: () => {
      toast.success(t("studio.admin_authors.toast.suspended"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) =>
      patchAuthorPlatformRole(id, role),
    onSuccess: () => {
      toast.success(t("studio.admin_authors.toast.role_updated"));
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const authors = data?.authors ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const contact = (a: AdminAuthorDTO) => a.email || a.phone_number || "—";

  const displayName = (a: AdminAuthorDTO) =>
    [a.firstname, a.lastname].filter(Boolean).join(" ").trim() || contact(a);

  const roleLabel = (role: PlatformRole) =>
    t(`studio.admin_authors.role.${role.toLowerCase()}`);

  const emptyMessage = debouncedSearch
    ? roleFilter
      ? t("studio.admin_authors.empty.search_and_role", {
          search: debouncedSearch,
          role: roleLabel(roleFilter),
        })
      : t("studio.admin_authors.empty.search", { search: debouncedSearch })
    : roleFilter
      ? t("studio.admin_authors.empty.role", { role: roleLabel(roleFilter) })
      : t("studio.admin_authors.empty.none");

  if (userInfo && !canAccess) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <div className="font-dynamic border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="px-4 pt-10 pb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {t("studio.admin_authors.title")}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
            <IoMdSearch className="w-4 h-4 shrink-0" />
            <Pecha.Input
              type="search"
              aria-label={t("studio.admin_authors.search_aria")}
              placeholder={t("studio.admin_authors.search_placeholder")}
              className="w-64 rounded-md border-none dark:bg-transparent px-3 shadow-none py-2 max-md:w-48"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
            {search ? (
              <button
                type="button"
                aria-label={t("studio.admin_authors.clear_search")}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearch("");
                  setPage(0);
                }}
              >
                <IoMdClose className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <select
            aria-label={t("studio.admin_authors.filter_by_role")}
            className="h-9 rounded-md border bg-white px-2 text-sm dark:bg-input/30"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as PlatformRole | "");
              setPage(0);
            }}
          >
            <option value="">{t("studio.admin_authors.all_roles")}</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
          <Button
            variant={inQueueView ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActivationQueue(true);
              setSearch("");
              setRoleFilter("");
              setPage(0);
            }}
          >
            {t("studio.admin_authors.activation_queue")}
          </Button>
          <Button
            variant={!inQueueView ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActivationQueue(false);
              setPage(0);
            }}
          >
            {t("studio.admin_authors.all_authors")}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="px-4 text-destructive text-sm">
          {getApiErrorMessage(error)}
        </p>
      ) : null}

      <div className="px-4 pb-8 overflow-x-auto">
        <Pecha.Table>
          <Pecha.TableHeader>
            <Pecha.TableRow>
              <Pecha.TableHead>{t("studio.common.name")}</Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.admin_authors.table.contact")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.admin_authors.table.role")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.admin_authors.table.verified")}
              </Pecha.TableHead>
              <Pecha.TableHead>
                {t("studio.admin_authors.table.active")}
              </Pecha.TableHead>
              {showActionsColumn ? (
                <Pecha.TableHead>{t("studio.common.actions")}</Pecha.TableHead>
              ) : null}
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <Pecha.TableBody>
            {isLoading ? (
              <Pecha.TableRow>
                <Pecha.TableCell colSpan={tableColumnCount}>
                  {t("studio.common.loading")}
                </Pecha.TableCell>
              </Pecha.TableRow>
            ) : authors.length === 0 ? (
              <Pecha.TableRow>
                <Pecha.TableCell colSpan={tableColumnCount}>
                  {emptyMessage}
                </Pecha.TableCell>
              </Pecha.TableRow>
            ) : (
              authors.map((author) => (
                <Pecha.TableRow key={author.id}>
                  <Pecha.TableCell>{displayName(author)}</Pecha.TableCell>
                  <Pecha.TableCell>{contact(author)}</Pecha.TableCell>
                  <Pecha.TableCell>
                    {writeEnabled ? (
                      <select
                        aria-label={t(
                          "studio.admin_authors.table.role_select_aria",
                          {
                            name: displayName(author),
                          },
                        )}
                        className="rounded border bg-background px-2 py-1 text-sm"
                        value={author.platform_role}
                        onChange={(e) =>
                          roleMutation.mutate({
                            id: author.id,
                            role: e.target.value as PlatformRole,
                          })
                        }
                        disabled={roleMutation.isPending}
                      >
                        <option value="CREATOR">{roleLabel("CREATOR")}</option>
                        <option value="CONTENT_ADMIN">
                          {roleLabel("CONTENT_ADMIN")}
                        </option>
                        <option value="REVIEWER">
                          {roleLabel("REVIEWER")}
                        </option>
                        <option value="SUPER_ADMIN">
                          {roleLabel("SUPER_ADMIN")}
                        </option>
                      </select>
                    ) : (
                      roleLabel(author.platform_role)
                    )}
                  </Pecha.TableCell>
                  <Pecha.TableCell>
                    {author.is_verified
                      ? t("studio.common.yes")
                      : t("studio.common.no")}
                  </Pecha.TableCell>
                  <Pecha.TableCell>
                    {author.is_active
                      ? t("studio.common.yes")
                      : t("studio.common.no")}
                  </Pecha.TableCell>
                  {showActionsColumn ? (
                    <Pecha.TableCell>
                      <div className="flex gap-2">
                        {!author.is_active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={activateMutation.isPending}
                            onClick={() => activateMutation.mutate(author.id)}
                          >
                            {t("studio.admin_authors.activate")}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={suspendMutation.isPending}
                            onClick={() => suspendMutation.mutate(author.id)}
                          >
                            {t("studio.admin_authors.suspend")}
                          </Button>
                        )}
                      </div>
                    </Pecha.TableCell>
                  ) : null}
                </Pecha.TableRow>
              ))
            )}
          </Pecha.TableBody>
        </Pecha.Table>

        {totalPages > 1 ? (
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 0}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("studio.common.previous")}
            </Button>
            <span className="text-sm self-center">
              {t("studio.common.page_of", {
                page: page + 1,
                total: totalPages,
              })}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("studio.common.next")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminAuthorsPage;
