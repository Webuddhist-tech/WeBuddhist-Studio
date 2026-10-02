import type { ReactNode } from "react";
import { Button } from "@/components/ui/atoms/button";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import GroupTitleWithAvatar from "./GroupTitleWithAvatar";

/** On a phone the whole page scrolls as one, so the header scrolls away and
 * leaves the screen to the content instead of pinning above a small window. */
const shellClassName =
  "flex flex-col border h-[calc(100vh-40px)] overflow-hidden bg-[#F3F3F3] dark:bg-[#181818] my-4 rounded-l-2xl font-dynamic max-md:my-0 max-md:h-full max-md:rounded-none max-md:border-0 max-md:overflow-y-auto";

const scrollAreaClassName =
  "flex-1 min-h-0 overflow-auto max-md:flex-none max-md:overflow-visible";

type GroupPageShellProps = {
  backLabel: string;
  onBack: () => void;
  title: string;
  avatarUrl?: string | null;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
};

export const GroupPageShell = ({
  backLabel,
  onBack,
  title,
  avatarUrl,
  subtitle,
  headerActions,
  nav,
  children,
}: GroupPageShellProps) => (
  <div className={shellClassName}>
    <div className="shrink-0 mb-4 px-4 sm:px-8 pt-10 flex items-start justify-between gap-4 max-md:flex-col max-md:gap-3 max-md:pt-4">
      <div className="min-w-0 flex-1 max-md:w-full">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2"
          onClick={onBack}
        >
          {backLabel}
        </Button>
        <GroupTitleWithAvatar
          title={title}
          avatarUrl={avatarUrl}
          size="md"
          className="border-b border-dashed border-black dark:border-white pb-2"
          titleClassName="text-xl font-bold"
        />
        {subtitle}
      </div>
      <div className="flex items-center gap-2 shrink-0 max-md:w-full max-md:flex-wrap max-md:shrink">
        {headerActions}
        <AuthButton />
      </div>
    </div>
    <div className="border-b w-full border-dashed border-gray-300 dark:border-input shrink-0" />
    {nav ? (
      <div className="shrink-0 max-md:sticky max-md:top-0 max-md:z-10 max-md:bg-[#F3F3F3] max-md:dark:bg-[#181818]">
        {nav}
      </div>
    ) : null}
    <div className={scrollAreaClassName}>{children}</div>
  </div>
);

export const GroupListShell = ({
  toolbar,
  children,
  footer,
}: {
  toolbar: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) => (
  <div className={shellClassName}>
    <div className="shrink-0">{toolbar}</div>
    <div className="border-b w-full border-dashed border-gray-300 dark:border-input shrink-0" />
    <div className={scrollAreaClassName}>{children}</div>
    {footer ? <div className="shrink-0">{footer}</div> : null}
  </div>
);
