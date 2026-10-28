import type {
  EligibilityEvaluationInput,
  EligibilityReason,
  EligibilityResult,
  EligibilitySkill,
  EligibilityWarning,
  MissingSkill,
  RequiredSkill,
} from "./types";

const EPSILON = 1e-9;

function dedupeSkills(skills: readonly EligibilitySkill[]): Map<string, EligibilitySkill> {
  const map = new Map<string, EligibilitySkill>();
  for (const skill of skills) {
    const current = map.get(skill.skillId);
    if (!current || skill.proficiency > current.proficiency) {
      map.set(skill.skillId, skill);
    }
  }
  return map;
}

function clampWeight(weight: number): number {
  if (!Number.isFinite(weight)) return 1;
  return Math.min(5, Math.max(1, weight));
}

function formatList(values: readonly (string | number)[]): string {
  return values.join(", ");
}

export function computeSkillMatch(
  requiredSkills: readonly RequiredSkill[],
  studentSkills: readonly EligibilitySkill[],
): { score: number; matchedSkillIds: string[]; missingSkills: MissingSkill[] } {
  if (requiredSkills.length === 0) {
    return { score: 100, matchedSkillIds: [], missingSkills: [] };
  }
  const studentMap = dedupeSkills(studentSkills);
  const requiredMap = new Map<string, RequiredSkill>();
  for (const required of requiredSkills) {
    const existing = requiredMap.get(required.skillId);
    if (!existing || required.minProficiency > existing.minProficiency) {
      requiredMap.set(required.skillId, required);
    }
  }

  let weightedTotal = 0;
  let weightedEarned = 0;
  const matchedSkillIds: string[] = [];
  const missingSkills: MissingSkill[] = [];

  for (const required of requiredMap.values()) {
    const weight = clampWeight(required.weight);
    const requiredMin = Math.max(1, required.minProficiency);
    const actual = Math.max(0, studentMap.get(required.skillId)?.proficiency ?? 0);
    const ratio = Math.min(1, actual / requiredMin);
    weightedTotal += weight;
    weightedEarned += weight * ratio;
    if (actual >= requiredMin) {
      matchedSkillIds.push(required.skillId);
    } else {
      missingSkills.push({
        skillId: required.skillId,
        name: required.name,
        required: requiredMin,
        actual,
        isMandatory: required.isMandatory,
      });
    }
  }

  const score = weightedTotal === 0 ? 100 : Math.round((weightedEarned / weightedTotal) * 100);
  matchedSkillIds.sort();
  missingSkills.sort((a, b) => a.skillId.localeCompare(b.skillId));
  return { score, matchedSkillIds, missingSkills };
}

export function evaluateEligibility({
  student,
  drive,
  now,
}: EligibilityEvaluationInput): EligibilityResult {
  const reasons: EligibilityReason[] = [];
  const warnings: EligibilityWarning[] = [];

  if (drive.status !== "ACTIVE") {
    reasons.push({
      code: "DRIVE_NOT_ACTIVE",
      field: "status",
      message: "This drive is not open for applications.",
    });
  }

  const deadline = new Date(drive.deadline);
  const nowDate = new Date(now);
  if (Number.isNaN(deadline.getTime()) || Number.isNaN(nowDate.getTime()) || nowDate.getTime() > deadline.getTime()) {
    reasons.push({
      code: "DEADLINE_PASSED",
      field: "deadline",
      message: "The application deadline has passed.",
      actual: nowDate.toISOString(),
      required: drive.deadline,
    });
  }

  if (drive.existingApplication) {
    const terminal = drive.existingApplication.status !== "WITHDRAWN";
    if (terminal) {
      reasons.push({
        code: "ALREADY_APPLIED",
        field: "application",
        message:
          drive.existingApplication.status === "REJECTED"
            ? "A previous application to this drive was rejected."
            : "You have already applied to this drive.",
        actual: drive.existingApplication.status,
      });
    }
  }

  const missingFields: string[] = [];
  if (student.cgpa === null || !Number.isFinite(student.cgpa)) missingFields.push("CGPA");
  if (student.backlogs === null || !Number.isFinite(student.backlogs)) missingFields.push("backlogs");
  if (!student.branch?.trim()) missingFields.push("branch");
  if (student.graduationYear === null || !Number.isFinite(student.graduationYear)) {
    missingFields.push("graduation year");
  }
  if (missingFields.length > 0) {
    reasons.push({
      code: "PROFILE_INCOMPLETE",
      field: "profile",
      message: `Complete these profile fields: ${missingFields.join(", ")}.`,
      actual: missingFields.join(", "),
    });
  }

  if (drive.rules.requireVerifiedProfile && !student.isVerified) {
    reasons.push({
      code: "PROFILE_NOT_VERIFIED",
      field: "isVerified",
      message: "Your profile is awaiting placement-officer verification.",
    });
  } else if (!drive.rules.requireVerifiedProfile && !student.isVerified) {
    warnings.push({
      code: "PROFILE_NOT_VERIFIED_OPTIONAL",
      message: "This drive does not require a verified profile, but verification improves recruiter visibility.",
    });
  }

  if (drive.rules.requireResume && !student.hasResume) {
    reasons.push({
      code: "RESUME_MISSING",
      field: "resume",
      message: "Upload a PDF resume before applying.",
    });
  }

  if (
    drive.rules.minCgpa !== null &&
    student.cgpa !== null &&
    student.cgpa + EPSILON < drive.rules.minCgpa
  ) {
    reasons.push({
      code: "CGPA_BELOW",
      field: "cgpa",
      message: `CGPA ${student.cgpa.toFixed(1)} < required ${drive.rules.minCgpa.toFixed(1)}`,
      actual: student.cgpa,
      required: drive.rules.minCgpa,
    });
  }

  if (
    drive.rules.maxBacklogs !== null &&
    student.backlogs !== null &&
    student.backlogs > drive.rules.maxBacklogs
  ) {
    reasons.push({
      code: "BACKLOGS_EXCEEDED",
      field: "backlogs",
      message: `${student.backlogs} backlog${student.backlogs === 1 ? "" : "s"} > allowed ${drive.rules.maxBacklogs}`,
      actual: student.backlogs,
      required: drive.rules.maxBacklogs,
    });
  }

  if (
    drive.rules.allowedBranches.length > 0 &&
    student.branch &&
    !drive.rules.allowedBranches.includes(student.branch)
  ) {
    reasons.push({
      code: "BRANCH_NOT_ALLOWED",
      field: "branch",
      message: `Branch ${student.branch} is not allowed. Allowed: ${formatList(drive.rules.allowedBranches)}.`,
      actual: student.branch,
      required: formatList(drive.rules.allowedBranches),
    });
  }

  if (
    drive.rules.allowedGraduationYears.length > 0 &&
    student.graduationYear !== null &&
    !drive.rules.allowedGraduationYears.includes(student.graduationYear)
  ) {
    reasons.push({
      code: "GRADUATION_YEAR_NOT_ALLOWED",
      field: "graduationYear",
      message: `Graduation year ${student.graduationYear} is not allowed. Allowed: ${formatList(drive.rules.allowedGraduationYears)}.`,
      actual: student.graduationYear,
      required: formatList(drive.rules.allowedGraduationYears),
    });
  }

  const { score, matchedSkillIds, missingSkills } = computeSkillMatch(drive.requiredSkills, student.skills);
  const studentMap = dedupeSkills(student.skills);

  for (const required of [...drive.requiredSkills].sort((a, b) => a.skillId.localeCompare(b.skillId))) {
    if (!required.isMandatory) continue;
    const actual = studentMap.get(required.skillId)?.proficiency ?? 0;
    const requiredMin = Math.max(1, required.minProficiency);
    if (actual < requiredMin) {
      reasons.push({
        code: "SKILL_PROFICIENCY_BELOW",
        field: `skill:${required.skillId}`,
        message: `${required.name} proficiency ${actual} < required ${requiredMin}`,
        actual,
        required: requiredMin,
        skillId: required.skillId,
      });
    }
  }

  const optionalGaps = missingSkills.filter((skill) => !skill.isMandatory);
  if (optionalGaps.length > 0) {
    warnings.push({
      code: "OPTIONAL_SKILL_GAP",
      message: `Optional skills below requirement: ${optionalGaps.map((skill) => `${skill.name} (${skill.actual}/${skill.required})`).join(", ")}.`,
    });
  }

  const accepted = [...student.acceptedOffers];
  const bestAccepted = accepted.reduce(
    (best, offer) => (offer.package > best ? offer.package : best),
    Number.NEGATIVE_INFINITY,
  );
  const hasAcceptedOffer = accepted.length > 0;
  const dreamUpgrade =
    hasAcceptedOffer &&
    drive.policy.dreamOfferEnabled &&
    drive.package > bestAccepted + drive.policy.minimumDreamOfferIncrease + EPSILON;

  if (hasAcceptedOffer) {
    if (drive.policy.blockedPlacedTiers.includes(drive.tier) && !dreamUpgrade) {
      reasons.push({
        code: "PLACED_TIER_BLOCKED",
        field: "tier",
        message: `Already placed with ${bestAccepted.toFixed(1)} LPA; policy blocks applications to tier ${drive.tier} drives.`,
        actual: bestAccepted,
        required: drive.tier,
      });
    }
    if (accepted.length >= drive.policy.maxOffersPerStudent && !dreamUpgrade) {
      reasons.push({
        code: "MAX_OFFERS_REACHED",
        field: "offers",
        message: `Maximum accepted offers (${drive.policy.maxOffersPerStudent}) reached.`,
        actual: accepted.length,
        required: drive.policy.maxOffersPerStudent,
      });
    }
  }

  const isDreamOffer = Boolean(dreamUpgrade && (drive.policy.blockedPlacedTiers.includes(drive.tier) || accepted.length >= drive.policy.maxOffersPerStudent));
  if (isDreamOffer) {
    warnings.push({
      code: "DREAM_OFFER_UPGRADE",
      message: `Dream-offer exception applied: ${drive.package.toFixed(1)} LPA improves on your accepted offer of ${bestAccepted.toFixed(1)} LPA.`,
    });
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    warnings,
    matchScore: score,
    matchedSkillIds,
    missingSkills,
    isDreamOffer,
    snapshotVersion: 1,
  };
}
