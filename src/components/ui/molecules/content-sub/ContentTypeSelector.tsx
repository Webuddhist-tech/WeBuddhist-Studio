import { Pecha } from "@/components/ui/shadimport";
import { useTranslate } from "@tolgee/react";
import { IoMdAdd, IoMdVideocam } from "react-icons/io";
import { IoMusicalNotesSharp, IoTextOutline } from "react-icons/io5";
import { MdOutlineImage } from "react-icons/md";
import { LuCalendarDays, LuLayers, LuNewspaper } from "react-icons/lu";
import { GiPrayerBeads } from "react-icons/gi";
import pechaIcon from "@/assets/icon/pecha_icon.png";
import { useState } from "react";
import { SourceSelectorSheet } from "../webuddhist-source/SourceSelectorSheet";
import { LinkedContentSelectorSheet } from "../linked-content/LinkedContentSelectorSheet";
import {
  LINKED_CONTENT_I18N,
  isLinkedContentType,
  type LinkedContentOption,
  type LinkedContentType,
} from "../linked-content/linkedContent";

interface SourceData {
  content: string;
  pecha_segment_id: string;
  text_id: string;
  segment_ids: string[];
  segment_numbers?: number[];
}

interface ContentTypeSelectorProps {
  onSelectType: (
    type:
      | "IMAGE"
      | "VIDEO"
      | "AUDIO"
      | "TEXT"
      | "SOURCE_REFERENCE"
      | LinkedContentType,
    sourceData?: SourceData,
    linkedContent?: LinkedContentOption,
  ) => void;
  /** The plan's group; linked content may only come from it. */
  groupId?: string | null;
}

const iconClassName = "w-4 h-4 text-gray-400";

const contentTypes = [
  {
    key: "IMAGE",
    labelKey: "studio.common.image",
    icon: <MdOutlineImage className={iconClassName} />,
  },
  {
    key: "AUDIO",
    labelKey: "studio.common.audio",
    icon: <IoMusicalNotesSharp className={iconClassName} />,
  },
  {
    key: "VIDEO",
    labelKey: "studio.common.video",
    icon: <IoMdVideocam className={iconClassName} />,
  },
  {
    key: "TEXT",
    labelKey: "studio.content.type.text",
    icon: <IoTextOutline className={iconClassName} />,
  },
  {
    key: "SOURCE_REFERENCE",
    labelKey: "studio.content.type.source",
    icon: <img src={pechaIcon} alt="" className="w-4 h-4" />,
  },
  {
    key: "GROUP_ACCUMULATION",
    labelKey: LINKED_CONTENT_I18N.GROUP_ACCUMULATION.label,
    icon: <GiPrayerBeads className={iconClassName} />,
  },
  {
    key: "GROUP_COLLECTION",
    labelKey: LINKED_CONTENT_I18N.GROUP_COLLECTION.label,
    icon: <LuLayers className={iconClassName} />,
  },
  {
    key: "EVENT",
    labelKey: LINKED_CONTENT_I18N.EVENT.label,
    icon: <LuCalendarDays className={iconClassName} />,
  },
  {
    key: "POST",
    labelKey: LINKED_CONTENT_I18N.POST.label,
    icon: <LuNewspaper className={iconClassName} />,
  },
];

export const ContentTypeSelector = ({
  onSelectType,
  groupId,
}: ContentTypeSelectorProps) => {
  const { t } = useTranslate();
  const [showContentTypes, setShowContentTypes] = useState(false);
  const [isSourceSheetOpen, setIsSourceSheetOpen] = useState(false);
  const [linkedContentType, setLinkedContentType] =
    useState<LinkedContentType | null>(null);

  const handleContentTypeClick = (type: string) => {
    if (type === "SOURCE_REFERENCE") {
      setIsSourceSheetOpen(true);
      setShowContentTypes(false);
    } else if (isLinkedContentType(type)) {
      setLinkedContentType(type);
      setShowContentTypes(false);
    } else {
      onSelectType(type as any);
    }
  };

  const handleAddSource = (sourceData: SourceData) => {
    onSelectType("SOURCE_REFERENCE", sourceData);
    setIsSourceSheetOpen(false);
  };

  const handleAddLinkedContent = (
    type: LinkedContentType,
    option: LinkedContentOption,
  ) => {
    onSelectType(type, undefined, option);
    setLinkedContentType(null);
  };

  return (
    <>
      <div className="flex min-h-12 px-4 items-stretch gap-4 max-md:items-start max-md:gap-2">
        <Pecha.Button
          type="button"
          variant="outline"
          className="h-12 transition-transform active:scale-95"
          onClick={() => setShowContentTypes(!showContentTypes)}
        >
          <IoMdAdd
            className={`${iconClassName} transition-transform duration-300 ${showContentTypes ? "rotate-45" : "rotate-0"}`}
          />
        </Pecha.Button>

        {showContentTypes && (
          <div className="flex flex-wrap border min-h-12 bg-white dark:bg-[#161616] items-center px-1 border-gray-300 dark:border-input rounded-sm overflow-visible min-w-0 flex-1 py-1 animate-in zoom-in-90 slide-in-from-left-3 duration-300 ease-out">
            {contentTypes.map(({ key, labelKey, icon }, index) => (
              <Pecha.Button
                key={key}
                type="button"
                variant="ghost"
                onClick={() => handleContentTypeClick(key)}
                className="animate-in fade-in zoom-in-50 duration-300 ease-out hover:scale-110 transition-transform"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: "backwards",
                }}
              >
                {icon}
                <span className="text-xs">{t(labelKey)}</span>
              </Pecha.Button>
            ))}
          </div>
        )}
      </div>

      <SourceSelectorSheet
        isOpen={isSourceSheetOpen}
        onOpenChange={setIsSourceSheetOpen}
        onAddSource={handleAddSource}
      />

      <LinkedContentSelectorSheet
        type={linkedContentType}
        groupId={groupId}
        isOpen={linkedContentType !== null}
        onOpenChange={(open) => !open && setLinkedContentType(null)}
        onSelect={handleAddLinkedContent}
      />
    </>
  );
};
