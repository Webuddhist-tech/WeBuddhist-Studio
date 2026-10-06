import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IoMenu } from "react-icons/io5";
import pechaIcon from "../../../../assets/icon/pecha_icon.png";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "../../atoms/sheet";
import { ModeToggle } from "../mode-toggle/modetoggle";
import { LanguageToggle } from "../language-toggle/languageToggle";
import AuthLogout from "../auth-logout/AuthLogout";
import { InstallAppButton } from "../install-app/InstallAppButton";
import { AppUpdateButton } from "../install-app/AppUpdateButton";
import { useInstallMode } from "@/lib/pwaInstall";
import AuthButton from "@/components/ui/molecules/auth-button/AuthButton";
import { useNavModel, type NavItem } from "./useNavModel";

/** A phone's tab bar fits this many destinations beside the menu button. */
const MAX_TABS = 4;

const settingsRows = [
  { id: "install", component: <InstallAppButton />, label: "Install app" },
  { id: "theme", component: <ModeToggle />, label: "Change theme" },
  { id: "language", component: <LanguageToggle />, label: "Change language" },
  { id: "logout", component: <AuthLogout />, label: "Logout" },
];

/**
 * The Studio's navigation on a phone: a slim top bar naming the page, a tab
 * bar under the thumb for the everyday destinations, and a menu sheet holding
 * everything else. Desktop keeps the sidebar.
 */
export const MobileTopBar = () => {
  const { homePath, isActive, visiblePinnedItems, sections } = useNavModel();
  const current = [
    ...visiblePinnedItems,
    ...sections.flatMap((section) => section.items),
  ].find((item) => isActive(item.path));

  return (
    <header className="font-dynamic flex h-14 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-background px-4 pt-[env(safe-area-inset-top)] dark:border-[#313132]">
      <Link
        to={homePath}
        className="flex min-w-0 items-center gap-2"
        aria-label="Pecha Studio home"
      >
        <img
          src={pechaIcon}
          alt="Pecha Studio Logo"
          className="h-8 w-8 shrink-0"
        />
        <span className="truncate text-base font-semibold">
          {current?.label ?? "Pecha Studio"}
        </span>
      </Link>
      {/* Kept in the bar, not the menu: a waiting update should be seen. */}
      <div className="flex shrink-0 items-center gap-2">
        <AppUpdateButton showLabel />
        <AuthButton variant="compact" />
      </div>
    </header>
  );
};

export const MobileTabBar = () => {
  const {
    pathname,
    homePath,
    isActive,
    visiblePinnedItems,
    sections,
    activeSectionId,
  } = useNavModel();
  const [menuOpen, setMenuOpen] = useState(false);
  const installMode = useInstallMode();
  const menuSettingsRows = installMode
    ? settingsRows
    : settingsRows.filter((row) => row.id !== "install");

  // Following a link out of the menu should land on the page, not the menu.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const tabs = visiblePinnedItems.slice(0, MAX_TABS);
  const menuItems = visiblePinnedItems.slice(MAX_TABS);
  /** The menu tab lights up when the page you're on lives inside it. */
  const menuHoldsCurrentPage =
    Boolean(activeSectionId) || menuItems.some((item) => isActive(item.path));

  const renderMenuLink = (item: NavItem) => (
    <Link
      key={item.path}
      to={item.path}
      aria-current={isActive(item.path) ? "page" : undefined}
      onClick={() => setMenuOpen(false)}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors [&_svg]:size-5 ${
        isActive(item.path)
          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          : "text-zinc-600 active:bg-zinc-100 dark:text-zinc-400 dark:active:bg-zinc-800"
      }`}
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </Link>
  );

  return (
    <>
      <nav
        aria-label="Main"
        className="font-dynamic flex shrink-0 items-stretch border-t border-gray-200 bg-background pb-[env(safe-area-inset-bottom)] dark:border-[#313132]"
      >
        {tabs.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            aria-label={item.tooltip}
            aria-current={isActive(item.path) ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight transition-colors [&_svg]:size-5 ${
              isActive(item.path)
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {item.icon}
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] leading-tight transition-colors ${
            menuHoldsCurrentPage
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          <IoMenu className="size-5" />
          <span>Menu</span>
        </button>
      </nav>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="font-dynamic w-[85%] max-w-xs gap-0 p-0"
        >
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-4 pt-[calc(env(safe-area-inset-top)+1rem)] dark:border-[#313132]">
            <Link
              to={homePath}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2"
            >
              <img
                src={pechaIcon}
                alt="Pecha Studio Logo"
                className="h-9 w-9 shrink-0"
              />
              <SheetTitle className="text-base">Pecha Studio</SheetTitle>
            </Link>
            <SheetDescription className="sr-only">
              Every Studio page, and your settings
            </SheetDescription>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
            {visiblePinnedItems.map(renderMenuLink)}
            {sections.map((section) => (
              <div key={section.id} className="mt-3 flex flex-col gap-1">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {section.label}
                </p>
                {section.items.map(renderMenuLink)}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-gray-200 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] dark:border-[#313132]">
            {menuSettingsRows.map((row) => (
              <div key={row.id} className="flex items-center gap-3">
                {row.component}
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
