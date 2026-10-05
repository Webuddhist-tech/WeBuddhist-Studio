import { useState } from "react";
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
export function InstallAppButton() {
  const mode = useInstallMode();
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  if (!mode) return null;

  const install = async () => {
    if (mode === "ios") {
      setIosHelpOpen(true);
      return;
    }
    try {
      if (await promptInstall()) toast.success("Studio installed");
    } catch {
      toast.error("Could not open the install prompt");
    }
  };

  return (
    <>
      <Button variant="outline" size="icon" onClick={install}>
        <LuDownload className="size-4.5" />
        <span className="sr-only">Install app</span>
      </Button>

      <Pecha.AlertDialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <Pecha.AlertDialogContent>
          <Pecha.AlertDialogHeader>
            <Pecha.AlertDialogTitle>Install Studio</Pecha.AlertDialogTitle>
            <Pecha.AlertDialogDescription>
              Add the Studio to your Home Screen to open it like an app.
            </Pecha.AlertDialogDescription>
          </Pecha.AlertDialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <LuShare className="h-4 w-4" />
              </span>
              <span>
                Tap <strong>Share</strong> in the browser&apos;s toolbar.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <LuSquarePlus className="h-4 w-4" />
              </span>
              <span>
                Choose <strong>Add to Home Screen</strong>, then tap{" "}
                <strong>Add</strong>.
              </span>
            </li>
          </ol>
          <Pecha.AlertDialogFooter>
            <Pecha.AlertDialogAction>Got it</Pecha.AlertDialogAction>
          </Pecha.AlertDialogFooter>
        </Pecha.AlertDialogContent>
      </Pecha.AlertDialog>
    </>
  );
}
