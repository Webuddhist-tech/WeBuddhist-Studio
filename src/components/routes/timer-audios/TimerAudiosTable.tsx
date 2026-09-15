import { IoMdCreate, IoMdTrash } from "react-icons/io";
import { Pecha } from "@/components/ui/shadimport";
import type { TimerAudio } from "./api/timerAudiosApi";

interface TimerAudiosTableProps {
  audios: TimerAudio[];
  isLoading?: boolean;
  canManage: boolean;
  onEdit: (audio: TimerAudio) => void;
  onDelete: (audio: TimerAudio) => void;
}

const TimerAudiosTable = ({
  audios,
  isLoading,
  canManage,
  onEdit,
  onDelete,
}: TimerAudiosTableProps) => {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Loading timer audio presets...
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <Pecha.Table>
        <Pecha.TableHeader>
          <Pecha.TableRow>
            <Pecha.TableHead className="w-20">Cover</Pecha.TableHead>
            <Pecha.TableHead>Name</Pecha.TableHead>
            <Pecha.TableHead>Preview</Pecha.TableHead>
            {canManage ? (
              <Pecha.TableHead className="w-28 text-right">
                Actions
              </Pecha.TableHead>
            ) : null}
          </Pecha.TableRow>
        </Pecha.TableHeader>
        <Pecha.TableBody>
          {audios.map((audio) => (
            <Pecha.TableRow key={audio.id}>
              <Pecha.TableCell>
                {audio.image_url ? (
                  <img
                    src={audio.image_url}
                    alt={`${audio.name} cover`}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  // The cover is optional, so an empty slot is normal here.
                  <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                    —
                  </div>
                )}
              </Pecha.TableCell>
              <Pecha.TableCell className="font-medium">
                {audio.name}
              </Pecha.TableCell>
              {audio.audio_url ? (
                <Pecha.TableCell>
                  <audio
                    controls
                    preload="none"
                    src={audio.audio_url}
                    className="h-8 max-w-[220px]"
                  />
                </Pecha.TableCell>
              ) : (
                <Pecha.TableCell className="text-sm text-muted-foreground">
                  —
                </Pecha.TableCell>
              )}
              {canManage ? (
                <Pecha.TableCell>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(audio)}
                      className="p-2 rounded-md border hover:bg-muted/50 transition-colors"
                      aria-label={`Edit ${audio.name}`}
                    >
                      <IoMdCreate className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(audio)}
                      className="p-2 rounded-md border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      aria-label={`Delete ${audio.name}`}
                    >
                      <IoMdTrash className="w-4 h-4" />
                    </button>
                  </div>
                </Pecha.TableCell>
              ) : null}
            </Pecha.TableRow>
          ))}
        </Pecha.TableBody>
      </Pecha.Table>
    </div>
  );
};

export default TimerAudiosTable;
