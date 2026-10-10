import { useEffect, useState } from "react";
import { useTranslate } from "@tolgee/react";
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

/** Translation keys for the list text that names the kind of group. */
const LIST_TEXT_KEYS: Record<
  AuthorGroupType,
  {
    allLoaded: string;
    loadFailed: string;
    empty: string;
    create: string;
    loading: string;
    searchPlaceholder: string;
    new: string;
  }
> = {
  COMMUNITY: {
    allLoaded: "studio.groups.pages.list.all_loaded_community",
    loadFailed: "studio.groups.pages.list.load_failed_community",
    empty: "studio.groups.pages.list.empty_community",
    create: "studio.groups.pages.list.create_community",
    loading: "studio.groups.pages.list.loading_community",
    searchPlaceholder: "studio.groups.pages.list.search_placeholder_community",
    new: "studio.groups.pages.list.new_community",
  },
  PAGE: {
    allLoaded: "studio.groups.pages.list.all_loaded_page",
    loadFailed: "studio.groups.pages.list.load_failed_page",
    empty: "studio.groups.pages.list.empty_page",
    create: "studio.groups.pages.list.create_page",
    loading: "studio.groups.pages.list.loading_page",
    searchPlaceholder: "studio.groups.pages.list.search_placeholder_page",
    new: "studio.groups.pages.list.new_page",
  },
};

function GroupsLoadMoreStatus({
  isFetchingNextPage,
  hasNextPage,
  hasGroups,
  allLoadedLabel,
}: Readonly<{
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  hasGroups: boolean;
  allLoadedLabel: string;
}>) {
  const { t } = useTranslate();
  if (isFetchingNextPage) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("studio.groups.pages.list.loading_more")}
      </p>
    );
  }
  if (hasNextPage) {
    return <span className="h-4" aria-hidden />;
  }
  if (hasGroups) {
    return <p className="text-sm text-muted-foreground">{allLoadedLabel}</p>;
  }
  return null;
}

/** Lists one type of group: practice spaces (communities) or pages. */
const Groups = ({ groupType }: Readonly<{ groupType: AuthorGroupType }>) => {
  const { t } = useTranslate();
  const kind = GROUP_KINDS[groupType];
  const textKeys = LIST_TEXT_KEYS[groupType];
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
        {t(textKeys.loadFailed, { error: getApiErrorMessage(error) })}
      </p>
    );
  } else if (isEmpty) {
    listContent = (
      <div className="flex flex-col h-full items-center justify-center">
        <p className="text-base text-muted-foreground">{t(textKeys.empty)}</p>
        <Button variant="outline" className="mt-2" asChild>
          <Link to={kind.newPath}>
            <IoMdAdd /> {t(textKeys.create)}
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
          loadingLabel={t(textKeys.loading)}
        />
        <div ref={sentinelRef} className="w-full py-4 flex justify-center">
          <GroupsLoadMoreStatus
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={Boolean(hasNextPage)}
            hasGroups={groups.length > 0}
            allLoadedLabel={t(textKeys.allLoaded)}
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
                placeholder={t(textKeys.searchPlaceholder)}
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
                <IoMdAdd /> {t(textKeys.new)}
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
