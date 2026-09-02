/// <reference types="vite/client" />

/**
 * Environment variables the frontend reads.
 *
 * Exactly one, deliberately. Everything else in the repo-root `.env` is **backend**
 * configuration and must never be set on a frontend host: Vite inlines any `VITE_`
 * variable into the built JavaScript, so an API key set here would be public.
 */
interface ImportMetaEnv {
  /**
   * Base URL of the ORCA backend, e.g. `https://orca-api.example.com`.
   *
   * Leave unset when the API is served from the same origin — which covers local
   * development (Vite proxies `/api` to :8000) and any single-origin deployment.
   */
  readonly VITE_ORCA_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
