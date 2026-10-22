import { z } from 'zod';
import { isSafeStorageDir } from '../paths.js';

const argument = z.string().refine((value) => !value.includes('\0'), 'NUL characters are not allowed.');
export const checkConfigSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/u),
  name: z.string().trim().min(1).max(200),
  executable: argument.trim().min(1),
  args: z.array(argument).max(1024).default([]),
  required: z.boolean().default(true),
  timeoutMs: z.number().int().min(1).max(3_600_000).default(30_000),
  cwd: z.string().refine((value) => value === '.' || isSafeStorageDir(value), 'Use . or a safe project-relative directory.').default('.'),
});

export const verificationConfigSchema = z.strictObject({
  checks: z.array(checkConfigSchema).max(64).refine(
    (checks) => new Set(checks.map((check) => check.id)).size === checks.length,
    'Check identifiers must be unique.',
  ),
});
export type CheckConfig = z.infer<typeof checkConfigSchema>;
