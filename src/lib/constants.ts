export const ROLES = ["STUDENT", "PLACEMENT_OFFICER", "RECRUITER"] as const;
export type Role = (typeof ROLES)[number];

export const BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "AIML"] as const;
export type Branch = (typeof BRANCHES)[number];

export const SKILL_CATEGORIES = [
  "language",
  "framework",
  "database",
  "tools",
  "soft-skills",
] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: "Languages",
  framework: "Frameworks",
  database: "Databases",
  tools: "Tools",
  "soft-skills": "Soft skills",
};

export const DRIVE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "ACTIVE",
  "CLOSED",
  "COMPLETED",
  "REJECTED",
] as const;
export type DriveStatus = (typeof DRIVE_STATUSES)[number];

export const DRIVE_STATUS_LABELS: Record<DriveStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  CLOSED: "Closed",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
};

export const DRIVE_SOURCES = ["OFFICER", "RECRUITER"] as const;
export type DriveSource = (typeof DRIVE_SOURCES)[number];

export const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "IN_PROCESS",
  "OFFERED",
  "REJECTED",
  "WITHDRAWN",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  SHORTLISTED: "Shortlisted",
  IN_PROCESS: "In process",
  OFFERED: "Offered",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const ACTIVE_APPLICATION_STATUSES: ApplicationStatus[] = [
  "APPLIED",
  "SHORTLISTED",
  "IN_PROCESS",
  "OFFERED",
];

export const ROUND_TYPES = ["APTITUDE", "TECHNICAL", "HR", "GD", "OTHER"] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

export const ROUND_TYPE_LABELS: Record<RoundType, string> = {
  APTITUDE: "Aptitude",
  TECHNICAL: "Technical",
  HR: "HR",
  GD: "Group discussion",
  OTHER: "Other",
};

export const ROUND_STATUSES = ["PLANNED", "SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type RoundStatus = (typeof ROUND_STATUSES)[number];

export const ROUND_RESULT_STATUSES = [
  "PENDING",
  "SCHEDULED",
  "PASSED",
  "FAILED",
  "ABSENT",
  "WAIVED",
] as const;
export type RoundResultStatus = (typeof ROUND_RESULT_STATUSES)[number];

export const ROUND_RESULT_LABELS: Record<RoundResultStatus, string> = {
  PENDING: "Pending",
  SCHEDULED: "Scheduled",
  PASSED: "Passed",
  FAILED: "Failed",
  ABSENT: "Absent",
  WAIVED: "Waived",
};

export const OFFER_STATUSES = ["ACCEPTED", "DECLINED", "REVOKED"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  "DRIVE_NEW_ELIGIBLE",
  "DRIVE_UPDATED",
  "APPLICATION_STATUS",
  "ROUND_SCHEDULED",
  "ROUND_RESULT",
  "OFFER",
  "PROFILE_VERIFIED",
  "SKILL_VERIFIED",
  "DRIVE_APPROVAL",
  "SYSTEM",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const APPLICATION_SOURCES = ["STUDENT", "RECRUITER"] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const RESOURCE_TYPES = ["DOCS", "COURSE", "VIDEO", "PRACTICE"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const GRADUATION_YEARS = (() => {
  const current = new Date().getUTCFullYear();
  return [current, current + 1, current + 2, current + 3, current + 4];
})();

export const DEFAULT_PAGE_SIZE = 20;

export const DEMO_ACCOUNTS = [
  { role: "Student", email: "student@campus.test", password: "Student@123" },
  { role: "Ineligible student", email: "student2@campus.test", password: "Student@123" },
  { role: "Placed student", email: "student3@campus.test", password: "Student@123" },
  { role: "Placement officer", email: "officer@campus.test", password: "Officer@123" },
  { role: "Recruiter", email: "recruiter@campus.test", password: "Recruiter@123" },
] as const;
