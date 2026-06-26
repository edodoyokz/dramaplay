export interface Env {
  ENVIRONMENT: string;
  PROVIDER_BASE_URL: string;
  PROVIDER_API_TOKEN?: string;
  SAPIMU_PROVIDER_ENGINE?: "v2" | "legacy";
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  PAKASIR_API_KEY: string;
  PAKASIR_PROJECT_SLUG: string;
  CONSUMER_URL: string;
  RESEND_API_KEY?: string;
  REPORT_EMAIL_TO?: string;
}
