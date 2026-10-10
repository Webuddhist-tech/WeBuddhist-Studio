import { useState, type ReactNode } from "react";
import { useTranslate } from "@tolgee/react";
import { LuDownload, LuShare, LuSquarePlus } from "react-icons/lu";
import { toast } from "sonner";
import { Pecha } from "@/components/ui/shadimport";
import { Button } from "../../atoms/button";
import { promptInstall, useInstallMode } from "@/lib/pwaInstall";

/**
 * Installs the Studio as an app. Chrome and Edge show their install prompt;
 * on iPhone and iPad, where apps are added from Safari's Share menu, it shows
 * those steps. Renders nothing when the Studio cannot be installed here or
 * already runs as the installed app; menus check `useInstallMode` to leave out
 * its row.
 */
/** Swaps each `{name}` in a translated sentence for its bold label. */
const withBold = (sentence: string, labels: Record<string, string>) =>
  sentence
    .split(/\{(\w+)\}/)
    .map<ReactNode>((part, index) =>
      index % 2 === 1 ? (
        <strong key={index}>{labels[part] ?? part}</strong>
      ) : (
        part
      ),
    );

export function InstallAppButton() {
  const { t } = useTranslate();
  const mode = useInstallMode();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  if (!mode) return null;

  const install = async () => {
    if (mode === "ios") {
      setIosHelpOpen(true);
      return;
    }
    try {
      if (await promptInstall()) toast.success(t("studio.pwa.installed"));
    } catch {
      toast.error(t("studio.pwa.install_prompt_failed"));
    }
  };

  return (
    <>
      <Button variant="outline" size="icon" onClick={install}>
        <LuDownload className="size-4.5" />
        <span className="sr-only">{t("studio.nav.install_app")}</span>
      </Button>

      <Pecha.AlertDialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>
              {t("studio.pwa.ios_title")}
            </Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              {t("studio.pwa.ios_description")}
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <LuShare className="h-4 w-4" />
              </span>
              <span>
                {withBold(
                  t("studio.pwa.ios_step_share", { share: "{share}" }),
                  {
                    share: t("studio.pwa.ios_share"),
                  },
                )}
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <LuSquarePlus className="h-4 w-4" />
              </span>
              <span>
                {withBold(
                  t("studio.pwa.ios_step_add", {
                    add_to_home_screen: "{add_to_home_screen}",
                    add: "{add}",
                  }),
                  {
                    add_to_home_screen: t("studio.pwa.ios_add_to_home_screen"),
                    add: t("studio.pwa.ios_add"),
                  },
                )}
              </span>
            </li>
          </ol>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogAction>
              {t("studio.pwa.got_it")}
            </Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </>
  );
}
