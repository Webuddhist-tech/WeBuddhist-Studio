import { useEffect, useState } from "react";
import { IoMdAdd, IoMdSearch } from "react-icons/io";
import { useDebounce } from "use-debounce";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useInView } from "react-intersection-observer";
import { Link } from "react-router-dom";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { getApiErrorMessage } from "@/lib/apiErrors";
import { fetchGroups, type AuthorGroupType } from "./api/groupsApi";
import { GroupListShell } from "./components/GroupPageShell";
import GroupsList from "./GroupsList";
import PendingGroupInvitationsBlock from "./components/PendingGroupInvitationsBlock";
import { GROUP_KINDS } from "./lib/groupKind";

const PAGE_SIZE = 10;

function GroupsLoadMoreStatus({
  isFetchingNextPage,
  hasNextPage,
  hasGroups,
  plural,
}: Readonly<{
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  hasGroups: boolean;
  plural: string;
}>) {
  if (isFetchingNextPage) {
    return <p className="text-sm text-muted-foreground">Loading more…</p>;
  }
  if (hasNextPage) {
    return <span className="h-4" aria-hidden />;
  }
  if (hasGroups) {
    return (
      <p className="text-sm text-muted-foreground">
        All {plural.toLowerCase()} loaded
      </p>
    );
  }
  return null;
}

/** Lists one type of group: practice spaces (communities) or pages. */
const Groups = ({ groupType }: Readonly<{ groupType: AuthorGroupType }>) => {
  const kind = GROUP_KINDS[groupType];
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["cms-groups", debouncedSearch, groupType],
    queryFn: ({ pageParam }) =>
      fetchGroups({
        page: pageParam,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        group_type: groupType,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce(
        (sum, page) => sum + page.groups.length,
        0,
      );
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const groups = data?.pages.flatMap((page) => page.groups) ?? [];
  const isEmpty = groups.length === 0 && !isLoading;

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  let listContent;
  if (error) {
    listContent = (
      <p className="text-sm text-red-500 py-8">
        Failed to load {kind.plural.toLowerCase()}. {getApiErrorMessage(error)}
      </p>
    );
  } else if (isEmpty) {
    listContent = (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-base text-muted-foreground">
          No {kind.plural.toLowerCase()} found
        </p>
        <Button variant="outline" className="mt-2" asChild>
          <Link to={kind.newPath}>
            <IoMdAdd /> Create {kind.singular.toLowerCase()}
          </Link>
        </Button>
      </div>
    );
  } else {
    listContent = (
      <>
        <GroupsList
          groups={groups}
          isLoading={isLoading}
          loadingLabel={`Loading ${kind.plural.toLowerCase()}…`}
        />
        <div ref={sentinelRef} className="w-full py-4 flex justify-center">
          <GroupsLoadMoreStatus
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={Boolean(hasNextPage)}
            hasGroups={groups.length > 0}
            plural={kind.plural}
          />
        </div>
      </>
    );
  }

  return (
    <GroupListShell
      toolbar={
        <div className="mb-4 px-4 pt-10 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center flex-wrap gap-2">
            <div className="border w-fit px-2 bg-white dark:bg-input/30 rounded-md border-gray-200 dark:border-[#313132] flex items-center">
              <IoMdSearch className="w-4 h-4" />
              <Pecha.Input
                placeholder={`Search ${kind.plural.toLowerCase()}…`}
                className="rounded-md border-none dark:bg-transparent px-4 shadow-none py-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              className="bg-gray-100 hover:bg-gray-200"
              asChild
            >
              <Link to={kind.newPath}>
                <IoMdAdd /> New {kind.singular.toLowerCase()}
              </Link>
            </Button>
          </div>
          <AuthButton />
        </div>
      }
    >
      <div className="px-4 pt-4 pb-8 flex flex-col items-center">
        {listContent}
      </div>
      <PendingGroupInvitationsBlock />
    </GroupListShell>
  );
};

export default Groups;
