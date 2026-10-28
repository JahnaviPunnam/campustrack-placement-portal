import { z } from "zod";
import { driveCreateSchema, driveUpdateSchema, roundResultSchema } from "./officer";

const identifier = z.string().min(1);

export const recruiterDriveRequestSchema = driveCreateSchema;
export const recruiterDriveUpdateSchema = driveUpdateSchema;

export const shortlistCandidateSchema = z.object({
  driveId: identifier,
  studentProfileId: identifier,
  note: z.string().trim().max(500).optional().transform((value) => (value ? value : null)),
});

export const savedCandidateSchema = z.object({
  studentProfileId: identifier,
  note: z.string().trim().max(500).optional().transform((value) => (value ? value : null)),
});

export const savedCandidateRemoveSchema = z.object({
  studentProfileId: identifier,
});

export const recruiterFeedbackSchema = z.object({
  applicationId: identifier,
  feedback: z.string().trim().max(2000).transform((value) => (value ? value : null)),
});

export const recruiterRejectSchema = z.object({
  applicationId: identifier,
  reason: z.string().trim().min(3, "Add a short reason").max(500),
});

export const recruiterRoundResultSchema = roundResultSchema;

export type RecruiterDriveRequestInput = z.infer<typeof recruiterDriveRequestSchema>;
export type ShortlistCandidateInput = z.infer<typeof shortlistCandidateSchema>;
