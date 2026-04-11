import postgres from "postgres";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
});

const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
});

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export type Sql = typeof sql;
