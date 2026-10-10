import axiosInstance from "@/config/axios-config";
import { AUTHOR_NOT_ACTIVE_DETAIL } from "@/lib/platformAccess";
import { getApiErrorDetail } from "@/lib/apiErrors";
import { tolgee } from "@/i18n/tolgee";
import {
  PROFILE_REQUIRED_DETAIL,
  isProfileRequiredDetail,
} from "@/lib/phoneAuthApi";

export type EmailAuthorStatus = "ACTIVE" | "INACTIVE" | "PENDING_VERIFICATION";

export type EmailExchangeResponse = {
  author_id: string;
  email: string;
  status: EmailAuthorStatus;
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

export type EmailExchangePayload = {
  auth0_token: string;
  first_name?: string;
  last_name?: string;
};

export function isEmailExchangeInactive(
  response: EmailExchangeResponse,
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

export async function exchangeEmailToken(
  payload: EmailExchangePayload,
): Promise<EmailExchangeResponse> {
  const { data } = await axiosInstance.post<EmailExchangeResponse>(
    "/api/v1/cms/auth/email/exchange",
    payload,
  );
  return data;
}

export function getEmailAuthErrorMessage(
  error: unknown,
  fallback = tolgee.t("studio.auth.errors.email_auth_failed"),
): string {
  return getApiErrorDetail(error) ?? fallback;
}

export { PROFILE_REQUIRED_DETAIL, isProfileRequiredDetail };
