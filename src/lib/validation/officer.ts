import { z } from "zod";
import {
  BRANCHES,
  DRIVE_STATUSES,
  ROUND_RESULT_STATUSES,
  ROUND_STATUSES,
  ROUND_TYPES,
} from "@/lib/constants";

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

const optionalEmail = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || z.string().email().safeParse(value).success, "Enter a valid email");

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
  .refine((value) => {
    const parsed = new Date(`${value}T23:59:59.999Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Choose a valid date")
  .transform((value) => new Date(`${value}T23:59:59.999Z`));

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : null))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), "Enter a valid date and time");

const emptyNumber = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().min(min).max(max)])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value));

export const studentVerificationSchema = z.object({
  studentProfileId: z.string().min(1),
  isVerified: z.boolean(),
  note: optionalText(500),
});

export const skillVerificationSchema = z.object({
  studentSkillId: z.string().min(1),
  isVerified: z.boolean(),
});

export const importStudentsSchema = z.object({
  csv: z.string().min(1, "Paste CSV content or upload a file").max(2_000_000),
});

export const importedStudentRowSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Valid email required"),
  rollNumber: z
    .string()
    .trim()
    .min(3, "Roll number required")
    .max(24)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and dashes"),
  branch: z.enum(BRANCHES),
  graduationYear: z.coerce.number().int().min(2000).max(2100),
  cgpa: emptyNumber(0, 10),
  backlogs: z.coerce.number().int().min(0).max(30).default(0),
  phone: optionalText(20),
});

export const companySchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(100),
  industry: z.string().trim().min(2, "Industry is required").max(80),
  location: optionalText(80),
  website: optionalUrl,
  tier: z.coerce.number().int().min(1).max(3),
  description: optionalText(2000),
});

export const companyUpdateSchema = companySchema.extend({
  companyId: z.string().min(1),
});

export const companyStatusSchema = z.object({
  companyId: z.string().min(1),
  isActive: z.boolean(),
});

export const recruiterCreateSchema = z.object({
  companyId: z.string().min(1),
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Valid email required"),
  designation: optionalText(100),
  phone: optionalText(20),
});

export const recruiterStatusSchema = z.object({
  recruiterProfileId: z.string().min(1),
  isActive: z.boolean(),
});

export const recruiterResetSchema = z.object({
  recruiterProfileId: z.string().min(1),
});

export const driveSkillSchema = z.object({
  skillId: z.string().min(1),
  minProficiency: z.coerce.number().int().min(1).max(5),
  weight: z.coerce.number().int().min(1).max(5),
  isMandatory: z.boolean(),
});

export const driveRoundInputSchema = z.object({
  name: z.string().trim().min(2, "Round name is required").max(100),
  type: z.enum(ROUND_TYPES),
  description: optionalText(500),
  scheduledAt: optionalDateTime,
  durationMinutes: emptyNumber(5, 600),
  venue: optionalText(160),
  meetingLink: optionalUrl,
});

export const driveCreateSchema = z.object({
  companyId: z.string().min(1, "Choose a company"),
  title: z.string().trim().min(3, "Title is required").max(160),
  roleTitle: z.string().trim().min(2, "Role is required").max(100),
  description: optionalText(4000),
  package: z.coerce.number().min(0.1, "Package is required").max(500),
  location: z.string().trim().min(2, "Location is required").max(100),
  tier: z.coerce.number().int().min(1).max(3),
  openings: emptyNumber(1, 10_000),
  deadline: dateOnly,
  minCgpa: emptyNumber(0, 10),
  maxBacklogs: emptyNumber(0, 30),
  allowedBranches: z.array(z.enum(BRANCHES)).default([]),
  allowedGraduationYears: z.array(z.coerce.number().int().min(2000).max(2100)).default([]),
  requireVerifiedProfile: z.boolean(),
  requireResume: z.boolean(),
  requiredSkills: z
    .array(driveSkillSchema)
    .min(1, "Add at least one required skill")
    .max(30)
    .refine(
      (skills) => new Set(skills.map((skill) => skill.skillId)).size === skills.length,
      "Each skill can only appear once",
    ),
  rounds: z.array(driveRoundInputSchema).max(10).default([]),
});

export const driveUpdateSchema = driveCreateSchema.extend({
  driveId: z.string().min(1),
});

export const driveStatusSchema = z.object({
  driveId: z.string().min(1),
  status: z.enum(DRIVE_STATUSES),
});

export const driveApprovalSchema = z.object({
  driveId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  reason: optionalText(500),
});

export const roundCreateSchema = z.object({
  driveId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  type: z.enum(ROUND_TYPES),
  description: optionalText(500),
  scheduledAt: optionalDateTime,
  durationMinutes: emptyNumber(5, 600),
  venue: optionalText(160),
  meetingLink: optionalUrl,
  status: z.enum(ROUND_STATUSES).default("PLANNED"),
});

export const roundUpdateSchema = roundCreateSchema.extend({
  roundId: z.string().min(1),
});

export const roundRemoveSchema = z.object({
  roundId: z.string().min(1),
});

export const roundResultSchema = z.object({
  applicationId: z.string().min(1),
  roundId: z.string().min(1),
  status: z.enum(ROUND_RESULT_STATUSES),
  score: emptyNumber(0, 1000),
  slotAt: optionalDateTime,
  notes: optionalText(1000),
  feedback: optionalText(2000),
});

export const applicationStatusSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(["APPLIED", "SHORTLISTED", "IN_PROCESS", "REJECTED", "WITHDRAWN"]),
  reason: optionalText(500),
});

export const offerCreateSchema = z.object({
  applicationId: z.string().min(1),
  package: z.coerce.number().min(0.1).max(500),
  roleTitle: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(100),
  joiningDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null))
    .refine((value) => value === null || !Number.isNaN(value.getTime()), "Choose a valid joining date"),
  notes: optionalText(1000),
});

export const overrideCreateSchema = z.object({
  studentProfileId: z.string().min(1),
  driveId: z.string().min(1),
  reason: z.string().trim().min(10, "Explain the override (10+ characters)").max(500),
});

export const overrideRevokeSchema = z.object({
  overrideId: z.string().min(1),
  reason: z.string().trim().min(5, "Add a revocation reason").max(500),
});

export const policyUpdateSchema = z.object({
  maxOffersPerStudent: z.coerce.number().int().min(1).max(5),
  blockedPlacedTiers: z
    .string()
    .trim()
    .default("")
    .refine(
      (value) => value === "" || /^[1-3](,[1-3])*$/.test(value),
      "Use comma-separated tiers 1, 2, or 3",
    ),
  dreamOfferEnabled: z.boolean(),
  minimumDreamOfferIncrease: z.coerce.number().min(0).max(100),
  requireVerifiedProfileDefault: z.boolean(),
});

export type DriveCreateInput = z.infer<typeof driveCreateSchema>;
export type RecruiterCreateInput = z.infer<typeof recruiterCreateSchema>;
export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;
export type RoundResultInput = z.infer<typeof roundResultSchema>;
