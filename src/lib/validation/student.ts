import { z } from "zod";
import { BRANCHES, GRADUATION_YEARS } from "@/lib/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || /^https?:\/\/\S+$/i.test(value), "Enter a valid http(s) URL");

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^[0-9+\-\s()]{7,20}$/.test(value), "Enter a valid phone number"),
  branch: z.enum(BRANCHES),
  graduationYear: z.coerce
    .number()
    .int()
    .refine((year) => GRADUATION_YEARS.includes(year), "Select a valid graduation year"),
  cgpa: z
    .union([z.literal(""), z.coerce.number().min(0).max(10)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  backlogs: z.coerce.number().int().min(0).max(30),
  headline: optionalText(160),
  location: optionalText(80),
  githubUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  targetRoleProfileId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const skillInputSchema = z.object({
  skillId: z.string().min(1, "Choose a skill"),
  proficiency: z.coerce.number().int().min(1).max(5),
  evidence: z
    .string()
    .trim()
    .max(500, "Evidence must be 500 characters or fewer")
    .optional()
    .transform((value) => (value ? value : null)),
});

export const skillUpdateSchema = skillInputSchema.extend({
  studentSkillId: z.string().min(1),
});

export const skillRemoveSchema = z.object({
  studentSkillId: z.string().min(1),
});

export const targetRoleSchema = z.object({
  roleProfileId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const applyToDriveSchema = z.object({
  driveId: z.string().min(1),
  coverNote: z
    .string()
    .trim()
    .max(1500, "Cover note must be 1500 characters or fewer")
    .optional()
    .transform((value) => (value ? value : null)),
});

export const withdrawApplicationSchema = z.object({
  applicationId: z.string().min(1),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type SkillInput = z.infer<typeof skillInputSchema>;
export type SkillUpdateInput = z.infer<typeof skillUpdateSchema>;
