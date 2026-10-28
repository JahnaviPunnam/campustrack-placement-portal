export const REASON_CODES = [
  "DRIVE_NOT_ACTIVE",
  "DEADLINE_PASSED",
  "ALREADY_APPLIED",
  "PROFILE_INCOMPLETE",
  "PROFILE_NOT_VERIFIED",
  "RESUME_MISSING",
  "CGPA_BELOW",
  "BACKLOGS_EXCEEDED",
  "BRANCH_NOT_ALLOWED",
  "GRADUATION_YEAR_NOT_ALLOWED",
  "SKILL_PROFICIENCY_BELOW",
  "PLACED_TIER_BLOCKED",
  "MAX_OFFERS_REACHED",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const WARNING_CODES = [
  "DREAM_OFFER_UPGRADE",
  "OPTIONAL_SKILL_GAP",
  "PROFILE_NOT_VERIFIED_OPTIONAL",
  "RESUME_MISSING_OPTIONAL",
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export interface EligibilitySkill {
  skillId: string;
  name: string;
  proficiency: number;
}

export interface RequiredSkill {
  skillId: string;
  name: string;
  minProficiency: number;
  weight: number;
  isMandatory: boolean;
}

export interface AcceptedOffer {
  package: number;
  tier: number;
}

export interface EligibilityStudent {
  studentProfileId: string;
  cgpa: number | null;
  backlogs: number | null;
  branch: string;
  graduationYear: number | null;
  isVerified: boolean;
  hasResume: boolean;
  skills: EligibilitySkill[];
  acceptedOffers: AcceptedOffer[];
}

export interface EligibilityRules {
  minCgpa: number | null;
  maxBacklogs: number | null;
  allowedBranches: string[];
  allowedGraduationYears: number[];
  requireVerifiedProfile: boolean;
  requireResume: boolean;
}

export interface PlacementPolicyInput {
  maxOffersPerStudent: number;
  blockedPlacedTiers: number[];
  dreamOfferEnabled: boolean;
  minimumDreamOfferIncrease: number;
}

export interface EligibilityDrive {
  driveId: string;
  title: string;
  status: string;
  deadline: string;
  package: number;
  tier: number;
  rules: EligibilityRules;
  requiredSkills: RequiredSkill[];
  policy: PlacementPolicyInput;
  existingApplication: { status: string } | null;
}

export interface EligibilityReason {
  code: ReasonCode;
  field?: string;
  message: string;
  actual?: string | number;
  required?: string | number;
  skillId?: string;
}

export interface EligibilityWarning {
  code: WarningCode;
  message: string;
  skillId?: string;
}

export interface MissingSkill {
  skillId: string;
  name: string;
  required: number;
  actual: number;
  isMandatory: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
  warnings: EligibilityWarning[];
  matchScore: number;
  matchedSkillIds: string[];
  missingSkills: MissingSkill[];
  isDreamOffer: boolean;
  snapshotVersion: 1;
}

export interface EligibilityEvaluationInput {
  student: EligibilityStudent;
  drive: EligibilityDrive;
  now: string;
}

export interface GapTargetSkill {
  skillId: string;
  name: string;
  requiredProficiency: number;
  weight?: number;
  isMandatory?: boolean;
  resources?: GapResource[];
}

export interface GapResource {
  title: string;
  url: string;
  provider?: string | null;
  type: string;
}

export interface SkillGapItem {
  skillId: string;
  name: string;
  current: number;
  required: number;
  gap: number;
  isMandatory: boolean;
  resources: GapResource[];
}

export interface SkillGapResult {
  matchScore: number;
  missing: SkillGapItem[];
  strengths: { skillId: string; name: string; current: number; required: number }[];
  totalTargetSkills: number;
}
