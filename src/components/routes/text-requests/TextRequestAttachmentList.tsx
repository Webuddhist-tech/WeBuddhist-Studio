import { IoDocumentAttachOutline } from "react-icons/io5";
import {
  formatFileSize,
  type TextRequestAttachmentDTO,
} from "./api/textRequestsApi";

/** Download links for a request's files. The URLs are presigned and expire,
 * so this always renders the ones from the latest response. */
export const TextRequestAttachmentList = ({
  attachments,
}: {
  attachments: TextRequestAttachmentDTO[];
}) => {
  if (attachments.length === 0) return null;
  return (
    <ul className="space-y-1">
      {attachments.map((attachment) => (
        <li
          key={attachment.filename}
          className="flex items-center gap-2 text-sm"
        >
          <IoDocumentAttachOutline className="h-4 w-4 shrink-0 text-muted-foreground" />
          {attachment.url ? (
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate underline underline-offset-2 hover:text-[#A51C21]"
            >
              {attachment.filename}
            </a>
          ) : (
            <span className="truncate">{attachment.filename}</span>
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </span>
        </li>
      ))}
    </ul>
  );
};
