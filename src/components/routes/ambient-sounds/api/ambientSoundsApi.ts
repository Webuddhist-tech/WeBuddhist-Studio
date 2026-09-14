import axiosInstance from "@/config/axios-config";

export interface AmbientSound {
  id: string;
  name: string;
  url: string | null;
  is_default: boolean;
  display_order: number;
}

export interface AmbientSoundsResponse {
  sounds: AmbientSound[];
}

export interface CreateAmbientSoundPayload {
  name: string;
  displayOrder: number;
  isDefault: boolean;
  file: File;
}

export interface UpdateAmbientSoundPayload {
  name?: string;
  displayOrder?: number;
  isDefault?: boolean;
  file?: File;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${sessionStorage.getItem("accessToken")}`,
});

export const fetchAmbientSounds = async (): Promise<AmbientSoundsResponse> => {
  const { data } = await axiosInstance.get<AmbientSoundsResponse>(
    "/api/v1/ambient-sounds",
  );
  return data;
};

export const createAmbientSound = async (
  payload: CreateAmbientSoundPayload,
): Promise<AmbientSound> => {
  const body = new FormData();
  body.append("name", payload.name);
  body.append("display_order", String(payload.displayOrder));
  body.append("is_default", String(payload.isDefault));
  body.append("file", payload.file);

  const { data } = await axiosInstance.post<AmbientSound>(
    "/api/v1/ambient-sounds/cms",
    body,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const updateAmbientSound = async (
  id: string,
  payload: UpdateAmbientSoundPayload,
): Promise<AmbientSound> => {
  const body = new FormData();
  if (payload.name !== undefined) body.append("name", payload.name);
  if (payload.displayOrder !== undefined) {
    body.append("display_order", String(payload.displayOrder));
  }
  if (payload.isDefault !== undefined) {
    body.append("is_default", String(payload.isDefault));
  }
  if (payload.file) body.append("file", payload.file);

  const { data } = await axiosInstance.put<AmbientSound>(
    `/api/v1/ambient-sounds/cms/${id}`,
    body,
    { headers: getAuthHeaders() },
  );
  return data;
};

export const deleteAmbientSound = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/api/v1/ambient-sounds/cms/${id}`, {
    headers: getAuthHeaders(),
  });
};
