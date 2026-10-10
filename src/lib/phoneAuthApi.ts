import axiosInstance from "@/config/axios-config";
import { AUTHOR_NOT_ACTIVE_DETAIL } from "@/lib/platformAccess";
import { getApiErrorDetail } from "@/lib/apiErrors";
import { tolgee } from "@/i18n/tolgee";

export type PhoneAuthorStatus = "ACTIVE" | "INACTIVE" | "PENDING_VERIFICATION";

export type PhoneExchangeResponse = {
  author_id: string;
  phone_number: string;
  status: PhoneAuthorStatus;
  message: string;
  user: {
    name: string;
    image_url?: string | null;
  };
  auth?: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
  } | null;
};

export type PhoneLinkResponse = {
  author_id: string;
  phone_number: string;
  message: string;
};

export type PhoneExchangePayload = {
  auth0_token: string;
  first_name?: string;
  last_name?: string;
};

export const PROFILE_REQUIRED_DETAIL =
  "First name and last name are required for a new phone profile";

export function isProfileRequiredDetail(detail: unknown): boolean {
  if (typeof detail !== "string") return false;
  return detail.trim().toLowerCase() === PROFILE_REQUIRED_DETAIL.toLowerCase();
}

export function isPhoneExchangeInactive(
  response: PhoneExchangeResponse,
): boolean {
  if (response.status === "INACTIVE") return true;
  if (!response.auth?.access_token) {
    return (
      response.message.trim().toLowerCase() ===
      AUTHOR_NOT_ACTIVE_DETAIL.toLowerCase()
    );
  }
  return false;
}

export async function exchangePhoneToken(
  payload: PhoneExchangePayload,
): Promise<PhoneExchangeResponse> {
  const { data } = await axiosInstance.post<PhoneExchangeResponse>(
    "/api/v1/cms/auth/phone/exchange",
    payload,
  );
  return data;
}

export async function linkPhoneToken(
  auth0Token: string,
): Promise<PhoneLinkResponse> {
  const { data } = await axiosInstance.post<PhoneLinkResponse>(
    "/api/v1/cms/auth/phone/link",
    { auth0_token: auth0Token },
  );
  return data;
}

export function getPhoneAuthErrorMessage(
  error: unknown,
  fallback = tolgee.t("studio.auth.errors.phone_auth_failed"),
): string {
  return getApiErrorDetail(error) ?? fallback;
}
