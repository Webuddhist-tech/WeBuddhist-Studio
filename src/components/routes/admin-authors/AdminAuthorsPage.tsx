import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const AdminAuthorsPage = () => {
  const { data: userInfo } = useUserInfo();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [activationQueue, setActivationQueue] = useState(true);

  const canAccess = Boolean(
    userInfo && canAccessAdminAuthors(userInfo.platform_role),
  );
  const writeEnabled = isSuperAdmin(userInfo?.platform_role);
  const showActionsColumn = writeEnabled;
  const tableColumnCount = showActionsColumn ? 6 : 5;

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-authors", page, activationQueue],
    queryFn: () =>
      fetchAdminAuthors({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        ...(activationQueue ? { is_verified: true, is_active: false } : {}),
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
      toast.success("Author activated");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const suspendMutation = useMutation({
    mutationFn: suspendAuthor,
    onSuccess: () => {
      toast.success("Author suspended");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: PlatformRole }) =>
      patchAuthorPlatformRole(id, role),
    onSuccess: () => {
      toast.success("Platform role updated");
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

  if (userInfo && !canAccess) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return (
    <div className="font-dynamic border h-[calc(100vh-40px)] overflow-auto bg-[#F5F5F5] dark:bg-[#181818] my-4 rounded-l-2xl max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0">
      <div className="px-4 pt-10 pb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Authors</h1>
        <div className="flex gap-2">
          <Button
            variant={activationQueue ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActivationQueue(true);
              setPage(0);
            }}
          >
            Activation queue
          </Button>
          <Button
            variant={!activationQueue ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setActivationQueue(false);
              setPage(0);
            }}
          >
            All authors
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
              <Pecha.TableHead>Name</Pecha.TableHead>
              <Pecha.TableHead>Contact</Pecha.TableHead>
              <Pecha.TableHead>Role</Pecha.TableHead>
              <Pecha.TableHead>Verified</Pecha.TableHead>
              <Pecha.TableHead>Active</Pecha.TableHead>
              {showActionsColumn ? (
                <Pecha.TableHead>Actions</Pecha.TableHead>
              ) : null}
            </Pecha.TableRow>
          </Pecha.TableHeader>
          <Pecha.TableBody>
            {isLoading ? (
              <Pecha.TableRow>
                <Pecha.TableCell colSpan={tableColumnCount}>
                  Loading…
                </Pecha.TableCell>
              </Pecha.TableRow>
            ) : authors.length === 0 ? (
              <Pecha.TableRow>
                <Pecha.TableCell colSpan={tableColumnCount}>
                  No authors found.
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
                        <option value="CREATOR">CREATOR</option>
                        <option value="CONTENT_ADMIN">CONTENT_ADMIN</option>
                        <option value="REVIEWER">REVIEWER</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                      </select>
                    ) : (
                      author.platform_role
                    )}
                  </Pecha.TableCell>
                  <Pecha.TableCell>
                    {author.is_verified ? "Yes" : "No"}
                  </Pecha.TableCell>
                  <Pecha.TableCell>
                    {author.is_active ? "Yes" : "No"}
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
                            Activate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={suspendMutation.isPending}
                            onClick={() => suspendMutation.mutate(author.id)}
                          >
                            Suspend
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
              Previous
            </Button>
            <span className="text-sm self-center">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminAuthorsPage;
