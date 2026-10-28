import { describe, expect, it } from "vitest";
import {
  recruiterFeedbackSchema,
  recruiterRejectSchema,
  savedCandidateSchema,
  shortlistCandidateSchema,
} from "./recruiter";

describe("recruiter validation", () => {
  it("normalizes blank notes and feedback to null", () => {
    expect(
      shortlistCandidateSchema.parse({ driveId: "drive_1", studentProfileId: "student_1", note: " " }).note,
    ).toBeNull();
    expect(
      recruiterFeedbackSchema.parse({ applicationId: "application_1", feedback: "" }).feedback,
    ).toBeNull();
    expect(savedCandidateSchema.parse({ studentProfileId: "student_1" }).note).toBeNull();
  });

  it("requires ids for candidate actions", () => {
    expect(() => shortlistCandidateSchema.parse({ driveId: "", studentProfileId: "student_1" })).toThrow();
    expect(() => savedCandidateSchema.parse({ studentProfileId: "" })).toThrow();
  });

  it("requires a meaningful rejection reason", () => {
    expect(() =>
      recruiterRejectSchema.parse({ applicationId: "application_1", reason: "no" }),
    ).toThrow();
    expect(
      recruiterRejectSchema.parse({ applicationId: "application_1", reason: "Skills do not match" }),
    ).toEqual({ applicationId: "application_1", reason: "Skills do not match" });
  });
});
