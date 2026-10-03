/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_BASE_URL: string;
  readonly VITE_DEFAULT_LANGUAGE?: string;
  readonly VITE_ENV_SALT?: string;
  readonly VITE_YOUTUBE_API_KEY?: string;
  readonly VITE_WEBUDDHIST_PLAN_VIEWER_URL?: string;
  readonly VITE_LOCATIONIQ_TOKEN?: string;
  readonly VITE_USERBACK_ID?: string;
  /** Auth0 SPA tenant domain (public). */
  readonly VITE_AUTH0_DOMAIN?: string;
  /** Auth0 SPA client id (public). Never put secrets in Vite env. */
  readonly VITE_AUTH0_CLIENT_ID?: string;
  /** Auth0 API audience for SMS access tokens. */
  readonly VITE_AUTH0_AUDIENCE?: string;
  /** Auth0 Passwordless SMS connection name. Defaults to "sms". */
  readonly VITE_AUTH0_SMS_CONNECTION?: string;
  /** Auth0 Google social connection name. Defaults to "google-oauth2". */
  readonly VITE_AUTH0_GOOGLE_CONNECTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
