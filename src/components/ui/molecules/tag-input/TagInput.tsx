import { useState } from "react";
import { IoMdClose } from "react-icons/io";
import { useTranslate } from "@tolgee/react";
import { Input } from "../../atoms/input";

interface TagInputProps {
  value?: string[];
  onChange?: (tags: string[]) => void;
  size?: "sm" | "md";
}

const TagInput = ({ value = [], onChange, size = "md" }: TagInputProps) => {
  const { t } = useTranslate();
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      const normalizedTag =
        trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();

      if (!value.includes(normalizedTag)) {
        onChange?.([normalizedTag, ...value]);
      }
      setInputValue("");
    }
  };

  const removeTag = (indexToRemove: number) => {
    const newTags = value.filter((_, index) => index !== indexToRemove);
    onChange?.(newTags);
  };
  return (
    <div className=" w-full space-y-2 h-full font-dynamic flex flex-col">
      <p className="text-sm font-bold">{t("studio.molecules.tags.label")}</p>
      <div
        className={`w-full border p-2 overflow-auto space-y-4 rounded-md ${
          size === "sm" ? "min-h-[100px]" : "h-100"
        }`}
      >
        <Input
          placeholder={t("studio.molecules.tags.placeholder")}
          className=" border-none shadow-none bg-white"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="flex flex-wrap items-center justify-start h-fit gap-2">
          {value.map((tag, index) => (
            <div
              key={`${tag}-${index}`}
              className=" bg-gray-100 dark:bg-input/30 space-x-4 h-fit w-fit border border-dashed px-4 rounded-full py-2 flex items-center justify-between"
            >
              <p className="text-sm text-gray-500 dark:text-gray-100">{tag}</p>
              <IoMdClose
                className=" h-5 w-5 text-white rounded-full p-1 border border-dashed dark:bg-input/90 bg-gray-300 hover:bg-gray-400 transition cursor-pointer"
                onClick={() => removeTag(index)}
                aria-label={t("studio.molecules.tags.remove", { tag })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TagInput;
