import { Button } from "@/components/ui/atoms/button";
import { Input } from "@/components/ui/atoms/input";
import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { useTranslate } from "@tolgee/react";

interface ImageCropContentProps {
  imageSrc: string;
  onBack: () => void;
  onCropComplete: (image: Blob) => void;
  isProfilePage?: boolean;
}

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) =>
      reject(
        new Error(
          error instanceof ErrorEvent && error.message
            ? error.message
            : "Image load error",
        ),
      ),
    );
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

type CropFit = "horizontal-cover" | "vertical-cover" | "contain";
type AspectOption = "original" | "1:1" | "4:3" | "3:4" | "16:9";

/** `labelKey` options are translated; ratios like "4:3" read the same everywhere. */
type CropOption<T extends string> = {
  value: T;
  label: string;
  labelKey?: string;
};

const FIT_OPTIONS: CropOption<CropFit>[] = [
  {
    value: "contain",
    label: "Whole",
    labelKey: "studio.modals.image_crop.fit_whole",
  },
  {
    value: "horizontal-cover",
    label: "Width",
    labelKey: "studio.modals.image_crop.fit_width",
  },
  {
    value: "vertical-cover",
    label: "Height",
    labelKey: "studio.modals.image_crop.fit_height",
  },
];

const ASPECT_OPTIONS: CropOption<AspectOption>[] = [
  {
    value: "original",
    label: "Original",
    labelKey: "studio.modals.image_crop.ratio_original",
  },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "16:9", label: "16:9" },
];

const ASPECT_VALUES: Record<Exclude<AspectOption, "original">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
};

const getCroppedImg = async (imageSrc: string, pixelCrop: any) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  // The crop area may extend past the image (free positioning); fill the gap.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    image as CanvasImageSource,
    -pixelCrop.x,
    -pixelCrop.y,
    image.naturalWidth,
    image.naturalHeight,
  );
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (file) => {
        resolve(file);
      },
      "image/jpeg",
      0.92,
    );
  });
};

const OptionGroup = <T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: CropOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) => {
  const { t } = useTranslate();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-bold text-[#666] dark:text-[#d4d4d4] w-12">
        {label}
      </span>
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === value ? "default" : "outline"}
          className={
            option.value === value ? "bg-[#A51C21] text-white" : undefined
          }
          onClick={() => onChange(option.value)}
        >
          {option.labelKey ? t(option.labelKey) : option.label}
        </Button>
      ))}
    </div>
  );
};

const CropContainer = ({
  imageSrc,
  crop,
  zoom,
  aspect,
  fit,
  onCropChange,
  onCropComplete,
  onZoomChange,
  onMediaLoaded,
  isProfilePage,
}: {
  imageSrc: string;
  crop: { x: number; y: number };
  zoom: number;
  aspect: number;
  fit: CropFit;
  onCropChange: (crop: { x: number; y: number }) => void;
  onCropComplete: (_: any, croppedAreaPixels: any) => void;
  onZoomChange: (zoom: number) => void;
  onMediaLoaded: (size: {
    naturalWidth: number;
    naturalHeight: number;
  }) => void;
  isProfilePage?: boolean;
}) => (
  <div className="relative w-full h-[40vh] max-h-96 min-h-48 bg-[#b23434] dark:bg-[#c44848]">
    <Cropper
      image={imageSrc}
      crop={crop}
      zoom={zoom}
      aspect={aspect}
      objectFit={fit}
      minZoom={0.5}
      maxZoom={3}
      restrictPosition={false}
      onCropChange={onCropChange}
      onCropComplete={onCropComplete}
      onZoomChange={onZoomChange}
      onMediaLoaded={onMediaLoaded}
      cropShape={isProfilePage ? "round" : "rect"}
      showGrid={true}
    />
  </div>
);

const CropControls = ({
  zoom,
  onZoomChange,
  fit,
  onFitChange,
  aspectOption,
  onAspectChange,
}: {
  zoom: number;
  onZoomChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fit: CropFit;
  onFitChange: (fit: CropFit) => void;
  aspectOption: AspectOption;
  onAspectChange: (aspect: AspectOption) => void;
}) => {
  const { t } = useTranslate();
  return (
    <div className="p-4 border-t border-[#eee] dark:bg-[#111111] dark:border-[#222222] bg-[#fafafa] space-y-3">
      <OptionGroup
        label={t("studio.modals.image_crop.fit")}
        options={FIT_OPTIONS}
        value={fit}
        onChange={onFitChange}
      />
      <OptionGroup
        label={t("studio.modals.image_crop.ratio")}
        options={ASPECT_OPTIONS}
        value={aspectOption}
        onChange={onAspectChange}
      />
      <div className="mb-4 last:mb-0">
        <label className="block text-sm mb-2 text-[#666] dark:text-[#d4d4d4] font-bold">
          {t("studio.modals.image_crop.zoom", {
            percent: Math.round(zoom * 100),
          })}
        </label>
        <Input
          type="range"
          value={zoom}
          min={0.5}
          max={3}
          step={0.1}
          onChange={onZoomChange}
          className="w-full h-2 rounded-sm outline-none bg-[#ddd] opacity-70 transition-opacity appearance-none hover:opacity-100"
        />
      </div>
    </div>
  );
};

const CropActions = ({
  onBack,
  onCropConfirm,
  disabled,
}: {
  onBack: () => void;
  onCropConfirm: () => void;
  disabled: boolean;
}) => {
  const { t } = useTranslate();
  return (
    <div className="flex float-end gap-4 p-4 border-t border-[#eee] dark:border-[#222222]">
      <Button
        type="button"
        className="flex-1"
        variant="outline"
        onClick={onBack}
      >
        {t("studio.modals.image_crop.skip")}
      </Button>
      <Button
        type="button"
        variant="default"
        className="bg-[#A51C21] hover:bg-[#A51C21]/90 flex-1 text-white"
        onClick={onCropConfirm}
        disabled={disabled}
      >
        {t("studio.modals.image_crop.apply_crop")}
      </Button>
    </div>
  );
};

const ImageCropContent = ({
  imageSrc,
  onBack,
  onCropComplete,
  isProfilePage = false,
}: ImageCropContentProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<CropFit>("contain");
  const [aspectOption, setAspectOption] = useState<AspectOption>("original");
  const [naturalAspect, setNaturalAspect] = useState(4 / 3);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const aspect =
    aspectOption === "original" ? naturalAspect : ASPECT_VALUES[aspectOption];

  const resetPosition = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleFitChange = (next: CropFit) => {
    setFit(next);
    resetPosition();
  };

  const handleAspectChange = (next: AspectOption) => {
    setAspectOption(next);
    resetPosition();
  };

  const handleMediaLoaded = useCallback(
    ({
      naturalWidth,
      naturalHeight,
    }: {
      naturalWidth: number;
      naturalHeight: number;
    }) => {
      if (naturalWidth && naturalHeight) {
        setNaturalAspect(naturalWidth / naturalHeight);
      }
    },
    [],
  );

  const handleCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = useCallback(async () => {
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageBlob) onCropComplete(croppedImageBlob);
    } catch (e) {
      console.error("Error cropping image:", e);
    }
  }, [croppedAreaPixels, imageSrc, onCropComplete]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(Number(e.target.value));
  };

  return (
    <div className="flex flex-col flex-1 ">
      <CropContainer
        imageSrc={imageSrc}
        crop={crop}
        zoom={zoom}
        aspect={aspect}
        fit={fit}
        onCropChange={setCrop}
        onCropComplete={handleCropComplete}
        onZoomChange={setZoom}
        onMediaLoaded={handleMediaLoaded}
        isProfilePage={isProfilePage}
      />
      <CropControls
        zoom={zoom}
        onZoomChange={handleZoomChange}
        fit={fit}
        onFitChange={handleFitChange}
        aspectOption={aspectOption}
        onAspectChange={handleAspectChange}
      />
      <CropActions
        onBack={onBack}
        onCropConfirm={handleCropConfirm}
        disabled={!croppedAreaPixels}
      />
    </div>
  );
};

export default ImageCropContent;
