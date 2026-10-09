import axiosInstance from "@/config/axios-config";
import type { PlatformRole } from "@/lib/platformAccess";

export type AdminAuthorDTO = {
  id: string;
  email?: string | null;
  phone_number?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  platform_role: PlatformRole;
  is_verified: boolean;
  is_active: boolean;
  has_group: boolean;
  created_at?: string;
};

export type AdminAuthorsListResponse = {
  authors: AdminAuthorDTO[];
  skip: number;
  limit: number;
  total: number;
};

export type FetchAdminAuthorsParams = {
  is_verified?: boolean;
  is_active?: boolean;
  platform_role?: PlatformRole;
  search?: string;
  skip?: number;
  limit?: number;
};

export const fetchAdminAuthors = async (
  params: FetchAdminAuthorsParams = {},
): Promise<AdminAuthorsListResponse> => {
  const { data } = await axiosInstance.get<AdminAuthorsListResponse>(
    `/api/v1/cms/admin/authors`,
    {
      params: {
        skip: params.skip ?? 0,
        limit: params.limit ?? 20,
        ...(params.is_verified != null && { is_verified: params.is_verified }),
        ...(params.is_active != null && { is_active: params.is_active }),
        ...(params.platform_role && { platform_role: params.platform_role }),
        ...(params.search?.trim() && { search: params.search.trim() }),
      },
    },
  );
  return data;
};

export const activateAuthor = async (authorId: string) => {
  const { data } = await axiosInstance.post(
    `/api/v1/cms/admin/authors/${authorId}/activate`,
  );
  return data;
};

export const suspendAuthor = async (authorId: string) => {
  const { data } = await axiosInstance.post(
    `/api/v1/cms/admin/authors/${authorId}/suspend`,
  );
  return data;
};

export const patchAuthorPlatformRole = async (
  authorId: string,
  platform_role: PlatformRole,
) => {
  const { data } = await axiosInstance.patch(
    `/api/v1/cms/admin/authors/${authorId}/platform-role`,
    { platform_role },
  );
  return data;
};
