import { z } from "zod";

/**
 * Fail-fast Environment Schema using Zod.
 * Validates configuration at application startup to prevent runtime crashes.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_URL is required")
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY must be a valid key"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20, "SUPABASE_SERVICE_ROLE_KEY must be a valid key")
    .optional(),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url("NEXT_PUBLIC_SITE_URL must be a valid URL")
    .optional()
    .default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsed.success) {
  const errorDetails = parsed.error.issues
    .map((issue) => `  - [${issue.path.join(".")}] ${issue.message}`)
    .join("\n");
  const banner = `\n========================================================\n💥 [ADMIN CRITICAL ERROR] INVALID ENVIRONMENT CONFIGURATION\n========================================================\n${errorDetails}\n========================================================\n`;
  console.error(banner);
  throw new Error(`Invalid environment configuration:\n${errorDetails}`);
}

export const env = parsed.data;
