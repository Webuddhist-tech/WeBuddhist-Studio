import { useTranslate } from "@tolgee/react";
import { Button } from "@/components/ui/atoms/button";

type GroupImageFieldProps = {
  label: string;
  displayUrl: string | null;
  hasStoredImage: boolean;
  onUploadClick: () => void;
  imageClassName: string;
  readOnly?: boolean;
};

const GroupImageField = ({
  label,
  displayUrl,
  hasStoredImage,
  onUploadClick,
  imageClassName,
  readOnly = false,
}: GroupImageFieldProps) => {
  const { t } = useTranslate();
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{label}</p>
      <div className="flex flex-col gap-3">
        {displayUrl ? (
          <img src={displayUrl} alt={label} className={imageClassName} />
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={readOnly}
          onClick={onUploadClick}
        >
          {hasStoredImage
            ? t("studio.groups.components.image_field.change", {
                label: label.toLowerCase(),
              })
            : t("studio.groups.components.image_field.upload", {
                label: label.toLowerCase(),
              })}
        </Button>
      </div>
    </div>
  );
};

export default GroupImageField;
