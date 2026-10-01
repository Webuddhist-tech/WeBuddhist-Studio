import { Button } from "@/components/ui/atoms/button";
import Dropzone from "react-dropzone";
import ImageCropContent from "../modals/image-upload/image-crop/ImageCropModal";
import { useImageUploadDraft } from "../../../routes/task/hooks/useImageUploadDraft";
import { FiLoader } from "react-icons/fi";

interface InlineImageUploadProps {
  onUpload?: (file: File) => Promise<void> | void;
}

const InlineImageUpload = ({ onUpload }: InlineImageUploadProps) => {
  const {
    selectedFile,
    setSelectedFile,
    previewUrl,
    isCropOpen,
    setIsCropOpen,
    uploadUiBusy,
    handleCropComplete,
    handleUpload,
  } = useImageUploadDraft({ onUpload });

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
                    className="border border-dashed bg-[#FAFAFA] dark:bg-sidebar-secondary h-32 hover:border-gray-400 dark:hover:border-gray-500 transition-colors rounded-lg p-6 flex items-center justify-center cursor-pointer mb-4"
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

          <div className="flex justify-end">
            <Button
              variant="default"
              className="bg-[#A51C21] w-full py-6 font-medium dark:text-white hover:bg-[#A51C21]/90"
              onClick={handleUpload}
              disabled={!selectedFile || uploadUiBusy}
            >
              {uploadUiBusy && <FiLoader className="h-4 w-4 animate-spin" />}
              {uploadUiBusy ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default InlineImageUpload;
