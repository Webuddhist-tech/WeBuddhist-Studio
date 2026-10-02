import axiosInstance from "@/config/axios-config";

/** `id` here is an edition id, not a text id: the title-search endpoint
 * resolves each matching text to its first critical edition server-side
 * before returning it, so this can be passed directly to edition-scoped
 * endpoints (e.g. recordings) without a further text->edition lookup. */
export interface TextSearchResult {
  id: string;
  title: string;
}

export type ContributorRole =
  | "translator"
  | "reviser"
  | "author"
  | "scholar"
  | "narrator";

export interface RecordingContribution {
  type: "person" | "ai";
  id?: string | null;
  bdrc_id?: string | null;
  role: ContributorRole;
  name?: Record<string, string> | null;
}

export interface Person {
  id: string;
  bdrc_id?: string | null;
  wiki?: string | null;
  name: Record<string, string>;
  alt_names?: Record<string, string>[] | null;
}

export const personLabel = (person: Person) =>
  person.name?.en ?? Object.values(person.name)[0] ?? person.id;

export interface Recording {
  id: string;
  edition_id: string;
  text_id: string;
  title?: Record<string, string> | null;
  language?: string | null;
  license: string;
  date?: string | null;
  duration_ms: number | null;
  contributions: RecordingContribution[];
  format: string;
  size_bytes: number;
  audio_url: string;
}

const recordingsPath = (editionId: string) =>
  `/api/v1/cms/editions/${encodeURIComponent(editionId)}/recordings`;

const recordingPath = (recordingId: string) =>
  `/api/v1/cms/recordings/${encodeURIComponent(recordingId)}`;

/** Search texts by title, or list a default page when the title is blank -
 * so the picker has something to show before the user has typed anything. */
export const searchTexts = async (title: string) => {
  const { data } = await axiosInstance.get<TextSearchResult[]>(
    "/api/v1/texts/title-search",
    { params: { title: title || undefined, limit: 20, offset: 0 } },
  );
  return data;
};

/** Search persons by name, or list a default page when blank - same pattern
 * as searchTexts, so the contributor picker has something to show upfront. */
export const searchPersons = async (name: string) => {
  const { data } = await axiosInstance.get<Person[]>("/api/v1/cms/persons", {
    params: { name: name || undefined, limit: 20, offset: 0 },
  });
  return data;
};

export const fetchEditionRecordings = async (editionId: string) => {
  const { data } = await axiosInstance.get<Recording[]>(
    recordingsPath(editionId),
  );
  return data;
};

export const uploadRecording = async ({
  edition,
  file,
  durationMs,
  contribution,
  onProgress,
}: {
  edition: TextSearchResult;
  file: File;
  durationMs?: number;
  contribution: RecordingContribution;
  onProgress: (progress: number) => void;
}) => {
  const metadata = {
    duration_ms: durationMs,
    contributions: [contribution],
  };
  const body = new FormData();
  body.append("metadata", JSON.stringify(metadata));
  body.append("audio", file);

  const { data } = await axiosInstance.post<Recording>(
    recordingsPath(edition.id),
    body,
    {
      onUploadProgress: ({ loaded, total }) => {
        if (total) onProgress(Math.round((loaded * 100) / total));
      },
    },
  );
  return data;
};

export const deleteRecording = async (recordingId: string) => {
  await axiosInstance.delete(recordingPath(recordingId));
};

export const renameRecording = async (recordingId: string, title: string) => {
  const { data } = await axiosInstance.patch<Recording>(
    recordingPath(recordingId),
    { title: { en: title } },
  );
  return data;
};
