import { parse } from "csv-parse/sync";
import { prisma } from "@/server/db";
import { AppError } from "@/server/errors";
import { audit } from "@/server/audit";
import { generateTemporaryPassword, hashSeedPassword } from "@/server/auth/password";
import { importedStudentRowSchema } from "@/lib/validation/officer";
import { notifyUser } from "@/server/services/notifications";
import { escapeSpreadsheetCell } from "@/lib/csv";

export type StudentListFilters = {
  q?: string;
  branch?: string;
  graduationYear?: number;
  verified?: boolean;
  page?: number;
  pageSize?: number;
};

function studentWhere(filters: StudentListFilters) {
  return {
    ...(filters.q
      ? {
          OR: [
            { rollNumber: { contains: filters.q } },
            { user: { name: { contains: filters.q } } },
            { user: { email: { contains: filters.q } } },
            { phone: { contains: filters.q } },
          ],
        }
      : {}),
    ...(filters.branch ? { branch: filters.branch } : {}),
    ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
    ...(filters.verified !== undefined ? { isVerified: filters.verified } : {}),
  };
}

export async function listStudents(filters: StudentListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const where = studentWhere(filters);
  const [students, total] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, isActive: true } },
        targetRoleProfile: { select: { name: true } },
        _count: { select: { skills: true, applications: true, offers: true } },
      },
      orderBy: [{ graduationYear: "desc" }, { rollNumber: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.studentProfile.count({ where }),
  ]);
  return { students, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getStudentAdminDetail(studentProfileId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
      targetRoleProfile: true,
      verifiedBy: { select: { name: true } },
      skills: { include: { skill: true, verifiedBy: { select: { name: true } } }, orderBy: { updatedAt: "desc" } },
      applications: {
        include: { drive: { include: { company: true } }, offer: true, currentRound: true },
        orderBy: { appliedAt: "desc" },
      },
      offers: {
        include: { application: { include: { drive: { include: { company: true } } } } },
        orderBy: { offerDate: "desc" },
      },
      skillHistory: {
        include: { skill: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });
  if (!student) throw new AppError("STUDENT_NOT_FOUND", "Student not found.", 404);
  const auditLogs = await prisma.auditLog.findMany({
    where: { OR: [{ entityType: "StudentProfile", entityId: student.id }, { actorId: student.userId }] },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { actor: { select: { name: true } } },
  });
  return { student, auditLogs };
}

export async function verifyStudentProfile(input: {
  studentProfileId: string;
  isVerified: boolean;
  note: string | null;
  officerId: string;
}) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: input.studentProfileId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!student) throw new AppError("STUDENT_NOT_FOUND", "Student not found.", 404);
  const updated = await prisma.studentProfile.update({
    where: { id: student.id },
    data: {
      isVerified: input.isVerified,
      verifiedAt: input.isVerified ? new Date() : null,
      verifiedById: input.isVerified ? input.officerId : null,
      verificationNote: input.note,
    },
  });
  await audit({
    actorId: input.officerId,
    action: input.isVerified ? "STUDENT_VERIFIED" : "STUDENT_VERIFICATION_REVOKED",
    entityType: "StudentProfile",
    entityId: student.id,
    before: { isVerified: student.isVerified, verificationNote: student.verificationNote },
    after: { isVerified: updated.isVerified, verificationNote: updated.verificationNote },
  });
  await notifyUser({
    userId: student.userId,
    type: "PROFILE_VERIFIED",
    title: input.isVerified ? "Profile verified" : "Profile verification revoked",
    body: input.isVerified
      ? "The placement office verified your academic profile. Drives requiring verification are now open to you."
      : "The placement office needs you to update your profile before verification can continue.",
    link: "/student/profile",
    dedupeKey: `profile-verified:${student.id}:${updated.updatedAt.getTime()}`,
  });
  return updated;
}

export async function verifyStudentSkill(input: {
  studentSkillId: string;
  isVerified: boolean;
  officerId: string;
}) {
  const skill = await prisma.studentSkill.findUnique({
    where: { id: input.studentSkillId },
    include: {
      skill: { select: { name: true } },
      studentProfile: { select: { userId: true } },
    },
  });
  if (!skill) throw new AppError("SKILL_NOT_FOUND", "Student skill not found.", 404);
  const updated = await prisma.studentSkill.update({
    where: { id: skill.id },
    data: {
      isVerified: input.isVerified,
      verifiedAt: input.isVerified ? new Date() : null,
      verifiedById: input.isVerified ? input.officerId : null,
    },
  });
  await audit({
    actorId: input.officerId,
    action: input.isVerified ? "SKILL_VERIFIED" : "SKILL_VERIFICATION_REVOKED",
    entityType: "StudentSkill",
    entityId: skill.id,
    before: { isVerified: skill.isVerified },
    after: { isVerified: updated.isVerified },
    metadata: { skill: skill.skill.name },
  });
  await notifyUser({
    userId: skill.studentProfile.userId,
    type: "SKILL_VERIFIED",
    title: input.isVerified ? `${skill.skill.name} verified` : `${skill.skill.name} verification removed`,
    body: input.isVerified
      ? "The placement office verified this skill claim."
      : "An officer removed verification from this skill. Update your evidence if needed.",
    link: "/student/skills",
    dedupeKey: `skill-verified:${skill.id}:${updated.updatedAt.getTime()}`,
  });
  return updated;
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  fullname: "name",
  studentname: "name",
  email: "email",
  emailaddress: "email",
  rollnumber: "rollNumber",
  rollno: "rollNumber",
  roll: "rollNumber",
  branch: "branch",
  graduationyear: "graduationYear",
  gradyear: "graduationYear",
  year: "graduationYear",
  cgpa: "cgpa",
  backlogs: "backlogs",
  phone: "phone",
  mobile: "phone",
};

function normaliseHeader(value: string): string {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return HEADER_ALIASES[key] ?? value.trim();
}

export async function importStudentsCsv(csv: string, officerId: string) {
  let records: Record<string, unknown>[];
  try {
    records = parse(csv, {
      columns: (header: string[]) => header.map(normaliseHeader),
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, unknown>[];
  } catch {
    throw new AppError("CSV_INVALID", "The CSV could not be parsed. Check the header row and commas.", 400);
  }
  if (records.length === 0) throw new AppError("CSV_EMPTY", "The CSV has no data rows.", 400);
  if (records.length > 2000) throw new AppError("CSV_TOO_LARGE", "Import at most 2,000 students at a time.", 400);

  const errors: { row: number; message: string }[] = [];
  const valid: {
    row: number;
    data: ReturnType<typeof importedStudentRowSchema.parse>;
  }[] = [];
  const seenEmails = new Set<string>();
  const seenRolls = new Set<string>();

  records.forEach((record, index) => {
    const parsed = importedStudentRowSchema.safeParse(record);
    const row = index + 2;
    if (!parsed.success) {
      errors.push({
        row,
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      });
      return;
    }
    const email = parsed.data.email;
    const rollNumber = parsed.data.rollNumber;
    if (seenEmails.has(email)) {
      errors.push({ row, message: `Duplicate email in CSV: ${email}` });
      return;
    }
    if (seenRolls.has(rollNumber)) {
      errors.push({ row, message: `Duplicate roll number in CSV: ${rollNumber}` });
      return;
    }
    seenEmails.add(email);
    seenRolls.add(rollNumber);
    valid.push({ row, data: parsed.data });
  });

  if (valid.length === 0) {
    return { created: 0, updated: 0, failed: errors.length, credentials: [], errors };
  }

  const emails = valid.map((entry) => entry.data.email);
  const rolls = valid.map((entry) => entry.data.rollNumber);
  const [existingUsers, existingProfiles] = await Promise.all([
    prisma.user.findMany({
      where: { email: { in: emails } },
      include: { studentProfile: true },
    }),
    prisma.studentProfile.findMany({ where: { rollNumber: { in: rolls } } }),
  ]);
  const userByEmail = new Map(existingUsers.map((user) => [user.email, user]));
  const profileByRoll = new Map(existingProfiles.map((profile) => [profile.rollNumber, profile]));

  type ImportDecision =
    | { type: "create"; row: number; data: (typeof valid)[number]["data"]; password: string; hash: string }
    | { type: "update"; row: number; data: (typeof valid)[number]["data"]; profileId: string; userId: string };

  const decisions: ImportDecision[] = [];
  for (const entry of valid) {
    const user = userByEmail.get(entry.data.email);
    const profileByRollNumber = profileByRoll.get(entry.data.rollNumber);
    if (user && user.role !== "STUDENT") {
      errors.push({ row: entry.row, message: "Email belongs to a non-student account." });
      continue;
    }
    if (user?.studentProfile && user.studentProfile.rollNumber !== entry.data.rollNumber) {
      errors.push({ row: entry.row, message: "Email is already linked to a different roll number." });
      continue;
    }
    if (profileByRollNumber && profileByRollNumber.userId !== user?.id) {
      errors.push({ row: entry.row, message: "Roll number is already used by a different email." });
      continue;
    }
    if (user?.studentProfile) {
      decisions.push({
        type: "update",
        row: entry.row,
        data: entry.data,
        profileId: user.studentProfile.id,
        userId: user.id,
      });
      continue;
    }
    const password = generateTemporaryPassword();
    const hash = await hashSeedPassword(password);
    decisions.push({ type: "create", row: entry.row, data: entry.data, password, hash });
  }

  const credentials: { row: number; email: string; password: string }[] = [];
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    for (const decision of decisions) {
      if (decision.type === "create") {
        const user = await tx.user.create({
          data: {
            name: decision.data.name,
            email: decision.data.email,
            passwordHash: decision.hash,
            role: "STUDENT",
            mustChangePassword: true,
            studentProfile: {
              create: {
                rollNumber: decision.data.rollNumber,
                branch: decision.data.branch,
                graduationYear: decision.data.graduationYear,
                cgpa: decision.data.cgpa,
                backlogs: decision.data.backlogs,
                phone: decision.data.phone,
              },
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: officerId,
            action: "STUDENT_IMPORTED",
            entityType: "User",
            entityId: user.id,
            metadataJson: JSON.stringify({ email: decision.data.email, rollNumber: decision.data.rollNumber }),
          },
        });
        credentials.push({
          row: decision.row,
          email: decision.data.email,
          password: decision.password,
        });
        created += 1;
      } else {
        await tx.user.update({
          where: { id: decision.userId },
          data: { name: decision.data.name },
        });
        await tx.studentProfile.update({
          where: { id: decision.profileId },
          data: {
            branch: decision.data.branch,
            graduationYear: decision.data.graduationYear,
            cgpa: decision.data.cgpa,
            backlogs: decision.data.backlogs,
            phone: decision.data.phone,
            isVerified: false,
            verifiedAt: null,
            verifiedById: null,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: officerId,
            action: "STUDENT_IMPORT_UPDATED",
            entityType: "StudentProfile",
            entityId: decision.profileId,
            metadataJson: JSON.stringify({ email: decision.data.email }),
          },
        });
        updated += 1;
      }
    }
  });

  await audit({
    actorId: officerId,
    action: "STUDENT_CSV_IMPORTED",
    entityType: "StudentProfile",
    entityId: null,
    metadata: { created, updated, failed: errors.length, rows: records.length },
  });

  return { created, updated, failed: errors.length, credentials, errors };
}

export async function getStudentsForExport(filters: StudentListFilters) {
  return prisma.studentProfile.findMany({
    where: studentWhere(filters),
    include: {
      user: { select: { name: true, email: true } },
      targetRoleProfile: { select: { name: true } },
      _count: { select: { skills: true, applications: true } },
      offers: { where: { status: "ACCEPTED" }, select: { package: true }, orderBy: { package: "desc" }, take: 1 },
    },
    orderBy: { rollNumber: "asc" },
  });
}

export function studentExportCsv(rows: Awaited<ReturnType<typeof getStudentsForExport>>): string {
  const header = [
    "rollNumber",
    "name",
    "email",
    "branch",
    "graduationYear",
    "cgpa",
    "backlogs",
    "phone",
    "verified",
    "targetRole",
    "skills",
    "applications",
    "bestPackage",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    const values = [
      row.rollNumber,
      row.user.name,
      row.user.email,
      row.branch,
      String(row.graduationYear),
      row.cgpa?.toString() ?? "",
      String(row.backlogs),
      row.phone ?? "",
      row.isVerified ? "yes" : "no",
      row.targetRoleProfile?.name ?? "",
      String(row._count.skills),
      String(row._count.applications),
      row.offers[0]?.package?.toString() ?? "",
    ];
    lines.push(
      values
        .map((value) => escapeSpreadsheetCell(value))
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    );
  }
  return lines.join("\n");
}
