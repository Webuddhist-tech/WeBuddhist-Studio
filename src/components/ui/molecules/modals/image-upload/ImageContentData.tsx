import { Button } from "@/components/ui/atoms/button";
import Dropzone from "react-dropzone";
import { FiLoader } from "react-icons/fi";
import ImageCropContent from "./image-crop/ImageCropModal";
import { useImageUploadDraft } from "../../../../routes/task/hooks/useImageUploadDraft";

interface ImageContentDataProps {
  onCropClick?: (file: File) => void;
  onUpload?: (file: File) => Promise<void> | void;
  isLoading: boolean;
}

const ImageContentData = ({
  onCropClick,
  onUpload,
  isLoading,
}: ImageContentDataProps) => {
  const {
    selectedFile,
    setSelectedFile,
    previewUrl,
    isCropOpen,
    setIsCropOpen,
    uploadUiBusy,
    handleCropComplete,
    handleUpload,
  } = useImageUploadDraft({
    onUpload,
    onCropComplete: onCropClick,
    isExternallyBusy: isLoading,
  });

  return (
    <div className="space-y-4 min-w-0 w-full">
      {isCropOpen && selectedFile ? (
        <ImageCropContent
          imageSrc={previewUrl!}
          onBack={() => setIsCropOpen(false)}
          onCropComplete={handleCropComplete}
        />
      ) : (
        <>
          {!selectedFile ? (
            <Dropzone
              accept={{ "image/*": [] }}
              multiple={false}
              disabled={uploadUiBusy}
              onDrop={(acceptedFiles) => {
                if (acceptedFiles?.length) {
                  setSelectedFile(acceptedFiles[0]);
                }
              }}
            >
              {({ getRootProps, getInputProps }) => (
                <section>
                  <div
                    {...getRootProps()}
                    className="border border-dashed border-gray-300 h-32 hover:border-gray-400 transition-colors rounded-lg p-6 flex items-center justify-center cursor-pointer mb-4"
                  >
                    <input {...getInputProps()} />
                    <p>Drag & drop an image here, or click to select</p>
                  </div>
                </section>
              )}
            </Dropzone>
          ) : (
            <div className="flex flex-col gap-3 min-w-0">
              {/* Preview */}
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                <img
                  src={previewUrl!}
                  alt="preview"
                  className="w-full max-h-72 object-contain"
                />
              </div>

              {/* File info + actions */}
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-700 truncate flex-1 min-w-0">
                  {selectedFile?.name}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedFile(null)}
                    disabled={uploadUiBusy}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Button */}
          <Button
            className="bg-[#A51C21] w-full py-6 font-medium dark:text-white  hover:bg-[#A51C21]/90 hover:cursor-pointer"
            onClick={handleUpload}
            disabled={!selectedFile || uploadUiBusy}
          >
            {uploadUiBusy && <FiLoader className="h-4 w-4 animate-spin" />}
            {uploadUiBusy ? "Uploading..." : "Upload"}
          </Button>
        </>
      )}
    </div>
  );
};

export default ImageContentData;
