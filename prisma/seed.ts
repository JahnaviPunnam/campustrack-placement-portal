import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(42);
const pick = <T>(values: readonly T[]): T => values[Math.floor(random() * values.length)]!;
const randInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const round1 = (value: number) => Math.round(value * 10) / 10;
const days = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const monthsAgo = (n: number) => new Date(Date.now() - n * 30 * 24 * 60 * 60 * 1000);

const BRANCHES = ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "AIML"] as const;
const CATEGORIES = ["language", "framework", "database", "tools", "soft-skills"] as const;

type SkillSeed = { name: string; slug: string; category: (typeof CATEGORIES)[number] };

const SKILL_SLUG_OVERRIDES: Record<string, string> = {
  "C++": "cpp",
  "C#": "csharp",
  ".NET": "dotnet",
  "Vue.js": "vue",
};

const SKILLS: SkillSeed[] = [
  ...["C", "C++", "Java", "Python", "JavaScript", "TypeScript", "Go", "Rust", "Kotlin", "Swift", "SQL", "R", "C#", "Scala", "Dart"].map((name) => ({
    name,
    slug: SKILL_SLUG_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    category: "language" as const,
  })),
  ...["React", "Next.js", "Angular", "Vue.js", "Node.js", "Express.js", "Spring Boot", "Django", "Flask", "FastAPI", ".NET", "Flutter", "React Native", "Svelte", "Tailwind CSS", "GraphQL", "REST APIs"].map((name) => ({
    name,
    slug: SKILL_SLUG_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    category: "framework" as const,
  })),
  ...["MySQL", "PostgreSQL", "MongoDB", "Redis", "SQLite", "Oracle Database", "Firebase", "Elasticsearch", "DynamoDB"].map((name) => ({
    name,
    slug: SKILL_SLUG_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    category: "database" as const,
  })),
  ...["Git", "GitHub", "Docker", "Kubernetes", "Linux", "AWS", "Azure", "GCP", "Jenkins", "Postman", "Figma", "Terraform", "Jira", "Kafka", "Nginx"].map((name) => ({
    name,
    slug: SKILL_SLUG_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    category: "tools" as const,
  })),
  ...["Communication", "Teamwork", "Problem Solving", "Leadership", "Presentation", "Time Management", "Adaptability", "Critical Thinking"].map((name) => ({
    name,
    slug: SKILL_SLUG_OVERRIDES[name] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    category: "soft-skills" as const,
  })),
];

const FIRST_NAMES = [
  "Aarav", "Aditi", "Ananya", "Arjun", "Diya", "Ishaan", "Kavya", "Krish", "Meera", "Nikhil",
  "Priya", "Rahul", "Riya", "Rohan", "Saanvi", "Sahil", "Sara", "Shaurya", "Tara", "Ved",
  "Aisha", "Akash", "Bhavya", "Dev", "Gauri", "Harsh", "Ira", "Jatin", "Kiara", "Kunal",
  "Lavanya", "Manav", "Naina", "Neel", "Ojas", "Pooja", "Rachit", "Ridhi", "Sarthak", "Shreya",
  "Tanvi", "Uday", "Vaishnavi", "Varun", "Yash", "Zara", "Aniket", "Charu", "Dhruv", "Esha",
];
const LAST_NAMES = [
  "Mehta", "Sharma", "Patel", "Nair", "Reddy", "Iyer", "Gupta", "Verma", "Kapoor", "Singh",
  "Joshi", "Bose", "Menon", "Rao", "Chawla", "Das", "Kulkarni", "Malhotra", "Pillai", "Saxena",
];

const COMPANIES = [
  { name: "Acme Cloud", slug: "acme-cloud", industry: "Cloud infrastructure", tier: 3, location: "Bengaluru" },
  { name: "ByteWorks", slug: "byteworks", industry: "Product engineering", tier: 2, location: "Pune" },
  { name: "DataForge", slug: "dataforge", industry: "Data & analytics", tier: 2, location: "Hyderabad" },
  { name: "FinEdge", slug: "finedge", industry: "Fintech", tier: 2, location: "Mumbai" },
  { name: "Orbit Labs", slug: "orbit-labs", industry: "Developer tools", tier: 1, location: "Remote" },
  { name: "GreenGrid", slug: "greengrid", industry: "Clean energy", tier: 1, location: "Chennai" },
  { name: "Helix Health", slug: "helix-health", industry: "Health tech", tier: 2, location: "Bengaluru" },
  { name: "InnoSoft", slug: "innosoft", industry: "Enterprise software", tier: 2, location: "Noida" },
  { name: "PixelWorks", slug: "pixelworks", industry: "Design & media", tier: 1, location: "Remote" },
  { name: "Quantum Analytics", slug: "quantum-analytics", industry: "AI & analytics", tier: 3, location: "Hyderabad" },
];

async function createResumePdf() {
  const dir = path.resolve(process.cwd(), "uploads", "resumes");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "sample-resume.pdf");
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 54, size: "A4" });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(24).text("Aarav Mehta", { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#555555").text("CSE 2026 · CGPA 9.10 · Bengaluru, India");
    doc.moveDown(1);
    doc.fillColor("#000000").fontSize(14).text("Skills");
    doc.fontSize(10).text("TypeScript, React, Next.js, Node.js, PostgreSQL, Docker, Git, Communication");
    doc.moveDown(0.8);
    doc.fontSize(14).text("Projects");
    doc.fontSize(10).text("CampusTrack — a placement portal with automated eligibility and real-time updates.");
    doc.text("Library API — a typed REST service with PostgreSQL and comprehensive tests.");
    doc.moveDown(0.8);
    doc.fontSize(14).text("Education");
    doc.fontSize(10).text("B.Tech Computer Science, 2022–2026");
    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  return path.relative(process.cwd(), filePath).replaceAll("\\", "/");
}

async function main() {
  console.log("Resetting demo data…");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.applicationRoundResult.deleteMany();
  await prisma.application.deleteMany();
  await prisma.eligibilityOverride.deleteMany();
  await prisma.round.deleteMany();
  await prisma.driveRequiredSkill.deleteMany();
  await prisma.eligibilityRule.deleteMany();
  await prisma.drive.deleteMany();
  await prisma.savedCandidate.deleteMany();
  await prisma.recruiterProfile.deleteMany();
  await prisma.company.deleteMany();
  await prisma.skillHistory.deleteMany();
  await prisma.studentSkill.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.roleProfileSkill.deleteMany();
  await prisma.learningResource.deleteMany();
  await prisma.roleProfile.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.placementPolicy.deleteMany();
  await prisma.user.deleteMany();

  const [studentHash, officerHash, recruiterHash] = await Promise.all([
    bcrypt.hash("Student@123", 10),
    bcrypt.hash("Officer@123", 10),
    bcrypt.hash("Recruiter@123", 10),
  ]);
  const resumePath = await createResumePdf();

  const officer = await prisma.user.create({
    data: {
      name: "Priya Menon",
      email: "officer@campus.test",
      passwordHash: officerHash,
      role: "PLACEMENT_OFFICER",
      isActive: true,
    },
  });

  await prisma.placementPolicy.create({
    data: {
      id: "global",
      maxOffersPerStudent: 1,
      blockedPlacedTiers: "1,2",
      dreamOfferEnabled: true,
      minimumDreamOfferIncrease: 0,
      requireVerifiedProfileDefault: true,
      updatedById: officer.id,
    },
  });

  console.log("Creating skill catalog…");
  const skills = new Map<string, { id: string; name: string; slug: string; category: string }>();
  for (const seed of SKILLS) {
    const skill = await prisma.skill.create({
      data: {
        name: seed.name,
        slug: seed.slug,
        category: seed.category,
        description: `${seed.name} skill tracked across campus placement drives.`,
      },
    });
    skills.set(seed.slug, skill);
    await prisma.learningResource.createMany({
      data: [
        {
          skillId: skill.id,
          title: `${seed.name} documentation and reference`,
          url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(seed.name)}`,
          provider: "MDN / official docs",
          type: "DOCS",
        },
        {
          skillId: skill.id,
          title: `Practice ${seed.name} with guided exercises`,
          url: `https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(seed.name)}`,
          provider: "freeCodeCamp",
          type: "COURSE",
        },
      ],
    });
  }

  console.log("Creating role profiles…");
  const roleSeeds: { name: string; slug: string; description: string; skills: [string, number][] }[] = [
    {
      name: "Full-Stack Developer",
      slug: "full-stack-developer",
      description: "Builds end-to-end web products with typed frontends and reliable APIs.",
      skills: [["typescript", 4], ["react", 4], ["next-js", 3], ["node-js", 4], ["postgresql", 3], ["git", 4], ["communication", 3]],
    },
    {
      name: "Backend Developer",
      slug: "backend-developer",
      description: "Designs APIs, data models, and scalable services.",
      skills: [["java", 4], ["spring-boot", 4], ["postgresql", 4], ["rest-apis", 4], ["docker", 3], ["problem-solving", 4]],
    },
    {
      name: "Frontend Developer",
      slug: "frontend-developer",
      description: "Creates accessible, responsive user interfaces.",
      skills: [["javascript", 4], ["typescript", 4], ["react", 4], ["tailwind-css", 3], ["figma", 2], ["communication", 3]],
    },
    {
      name: "Data Analyst",
      slug: "data-analyst",
      description: "Turns data into decisions with SQL, Python, and clear communication.",
      skills: [["python", 4], ["sql", 4], ["postgresql", 3], ["presentation", 3], ["problem-solving", 4], ["critical-thinking", 4]],
    },
    {
      name: "DevOps Engineer",
      slug: "devops-engineer",
      description: "Automates delivery and operates reliable infrastructure.",
      skills: [["linux", 4], ["docker", 4], ["kubernetes", 4], ["aws", 3], ["terraform", 3], ["git", 4]],
    },
    {
      name: "ML Engineer",
      slug: "ml-engineer",
      description: "Builds and ships machine learning systems responsibly.",
      skills: [["python", 5], ["sql", 3], ["problem-solving", 4], ["critical-thinking", 4], ["docker", 3], ["presentation", 3]],
    },
  ];
  const roleProfiles = new Map<string, string>();
  for (const seed of roleSeeds) {
    const role = await prisma.roleProfile.create({
      data: { name: seed.name, slug: seed.slug, description: seed.description },
    });
    roleProfiles.set(seed.slug, role.id);
    await prisma.roleProfileSkill.createMany({
      data: seed.skills.map(([slug, requiredProficiency]) => ({
        roleProfileId: role.id,
        skillId: skills.get(slug)!.id,
        requiredProficiency,
        weight: 1,
        isMandatory: true,
      })),
    });
  }
  const defaultRoleId = roleProfiles.get("full-stack-developer")!;

  console.log("Creating 50 students…");
  type StudentRecord = {
    profileId: string;
    userId: string;
    email: string;
    name: string;
    rollNumber: string;
    branch: string;
    graduationYear: number;
    cgpa: number;
    backlogs: number;
  };
  const students: StudentRecord[] = [];
  const studentHashes = studentHash;

  for (let i = 0; i < 50; i++) {
    const first = FIRST_NAMES[i]!;
    const last = LAST_NAMES[i % LAST_NAMES.length]!;
    const name = `${first} ${last}`;
    const branch = i < 24 ? "CSE" : i < 34 ? "IT" : i < 40 ? "ECE" : i < 42 ? "EEE" : i < 44 ? "MECH" : i < 46 ? "CIVIL" : "AIML";
    const graduationYear = i < 32 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() + 1;
    let cgpa = round1(6.2 + random() * 3.6);
    let backlogs = random() < 0.7 ? 0 : randInt(1, 3);
    let email = i === 0 ? "student@campus.test" : i === 1 ? "student2@campus.test" : i === 2 ? "student3@campus.test" : `student${String(i + 1).padStart(2, "0")}@campus.test`;
    const rollNumber = `${branch}${graduationYear}${String(i + 1).padStart(3, "0")}`;

    if (i === 0) {
      cgpa = 9.1;
      backlogs = 0;
    }
    if (i === 1) {
      cgpa = 6.2;
      backlogs = 3;
    }
    if (i === 2) {
      cgpa = 8.8;
      backlogs = 0;
    }

    const verified = i !== 1 && (i === 0 || i % 13 !== 0);
    const hasResume = i === 0 || i % 11 !== 0;
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: studentHashes,
        role: "STUDENT",
        studentProfile: {
          create: {
            rollNumber,
            phone: `9${randInt(100000000, 899999999)}`,
            branch,
            graduationYear,
            cgpa,
            backlogs,
            headline: i % 4 === 0 ? `${branch} student interested in ${i % 2 === 0 ? "product engineering" : "data systems"}` : null,
            location: pick(["Bengaluru", "Hyderabad", "Pune", "Chennai", "Mumbai", "Remote"]),
            githubUrl: i % 5 === 0 ? null : `https://github.com/student-${i + 1}`,
            linkedinUrl: i % 6 === 0 ? null : `https://linkedin.com/in/student-${i + 1}`,
            resumePath: hasResume ? resumePath : null,
            resumeOriginalName: hasResume ? "sample-resume.pdf" : null,
            resumeMimeType: hasResume ? "application/pdf" : null,
            resumeSizeBytes: hasResume ? fs.statSync(path.resolve(process.cwd(), resumePath)).size : null,
            resumeUpdatedAt: hasResume ? monthsAgo(1) : null,
            targetRoleProfileId: i % 7 === 0 ? null : pick(Array.from(roleProfiles.values())),
            isVerified: verified,
            verifiedAt: verified ? monthsAgo(2) : null,
            verifiedById: verified ? officer.id : null,
            verificationNote: verified ? "Academic details checked against registrar record." : null,
          },
        },
      },
      include: { studentProfile: true },
    });
    const profile = user.studentProfile!;
    students.push({
      profileId: profile.id,
      userId: user.id,
      email,
      name,
      rollNumber,
      branch,
      graduationYear,
      cgpa,
      backlogs,
    });
  }

  const skillList = Array.from(skills.values());

  for (let i = 0; i < students.length; i++) {
    const student = students[i]!;
    const selected = new Map<string, { proficiency: number; evidence: string | null; verified: boolean }>();
    const skillCount = i === 0 ? 11 : randInt(6, 13);
    for (let j = 0; j < skillCount; j++) {
      const skill = skillList[(i * 7 + j * 3 + randInt(0, 9)) % skillList.length]!;
      const proficiency = Math.max(1, Math.min(5, randInt(2, 5)));
      selected.set(skill.id, {
        proficiency,
        evidence:
          random() < 0.55
            ? j % 2 === 0
              ? `Project: built a campus tool using ${skill.name}.`
              : `Certification: ${skill.name} fundamentals (2025).`
            : null,
        verified: random() < 0.55,
      });
    }

    const demoSkills: [string, number][] = [
      ["typescript", 5], ["react", 5], ["next-js", 4], ["node-js", 4], ["postgresql", 4],
      ["git", 4], ["docker", 3], ["communication", 4], ["problem-solving", 4], ["tailwind-css", 4],
      ["python", 5], ["sql", 4], ["presentation", 4],
    ];
    if (i === 0) {
      selected.clear();
      for (const [slug, proficiency] of demoSkills) {
        selected.set(skills.get(slug)!.id, {
          proficiency,
          evidence: `Project: ${slug} used in CampusTrack and two course projects.`,
          verified: true,
        });
      }
    }

    const entries = Array.from(selected.entries());
    await prisma.studentSkill.createMany({
      data: entries.map(([skillId, data]) => ({
        studentProfileId: student.profileId,
        skillId,
        proficiency: data.proficiency,
        evidence: data.evidence,
        isVerified: data.verified,
        verifiedAt: data.verified ? monthsAgo(2) : null,
        verifiedById: data.verified ? officer.id : null,
        createdAt: monthsAgo(6),
        updatedAt: monthsAgo(1),
      })),
    });

    const historyRows = entries.flatMap(([skillId, data]) => {
      const points = randInt(3, 5);
      const rows = [];
      for (let p = 0; p < points; p++) {
        const progress = Math.max(1, data.proficiency - (points - 1 - p));
        rows.push({
          studentProfileId: student.profileId,
          skillId,
          proficiency: progress,
          note: p === points - 1 ? "Current proficiency" : "Progress update",
          source: p === 0 ? "IMPORT" : "MANUAL",
          createdAt: monthsAgo((points - p) * 2),
        });
      }
      return rows;
    });
    await prisma.skillHistory.createMany({ data: historyRows });
  }

  console.log("Creating companies and recruiters…");
  const companyMap = new Map<string, { id: string; name: string; tier: number }>();
  for (let i = 0; i < COMPANIES.length; i++) {
    const seed = COMPANIES[i]!;
    const company = await prisma.company.create({
      data: {
        name: seed.name,
        slug: seed.slug,
        industry: seed.industry,
        tier: seed.tier,
        location: seed.location,
        website: `https://${seed.slug}.example.com`,
        description: `${seed.name} hires campus talent for ${seed.industry.toLowerCase()} teams.`,
        createdById: officer.id,
      },
    });
    companyMap.set(seed.slug, { id: company.id, name: company.name, tier: company.tier });
  }

  const recruiterData = [
    { company: "acme-cloud", email: "recruiter@campus.test", name: "Ritika Shah", designation: "Campus Lead", primary: true },
    { company: "dataforge", email: "recruiter2@campus.test", name: "Kabir Bansal", designation: "Talent Partner", primary: true },
    { company: "acme-cloud", email: "recruiter3@campus.test", name: "Neha Kulkarni", designation: "Engineering Manager", primary: false },
    { company: "finedge", email: "recruiter12@campus.test", name: "Siddharth Jain", designation: "Engineering Recruiter", primary: false },
    { company: "byteworks", email: "recruiter4@campus.test", name: "Rahul Dev", designation: "Campus Recruiter", primary: true },
    { company: "finedge", email: "recruiter5@campus.test", name: "Sneha Rao", designation: "Talent Acquisition", primary: true },
    { company: "orbit-labs", email: "recruiter6@campus.test", name: "Aman Verma", designation: "Founder's Office", primary: true },
    { company: "greengrid", email: "recruiter7@campus.test", name: "Divya Iyer", designation: "HR Lead", primary: true },
    { company: "helix-health", email: "recruiter8@campus.test", name: "Vikram Nair", designation: "Campus Lead", primary: true },
    { company: "innosoft", email: "recruiter9@campus.test", name: "Pallavi Joshi", designation: "Talent Partner", primary: true },
    { company: "pixelworks", email: "recruiter10@campus.test", name: "Arnav Bose", designation: "Design Recruiter", primary: true },
    { company: "quantum-analytics", email: "recruiter11@campus.test", name: "Meghna Reddy", designation: "Campus Lead", primary: true },
  ];
  const recruiters: { profileId: string; userId: string; companyId: string; email: string }[] = [];
  for (const seed of recruiterData) {
    const user = await prisma.user.create({
      data: {
        name: seed.name,
        email: seed.email,
        passwordHash: recruiterHash,
        role: "RECRUITER",
        recruiterProfile: {
          create: {
            companyId: companyMap.get(seed.company)!.id,
            designation: seed.designation,
            phone: `8${randInt(100000000, 899999999)}`,
            isPrimary: seed.primary,
          },
        },
      },
      include: { recruiterProfile: true },
    });
    recruiters.push({
      profileId: user.recruiterProfile!.id,
      userId: user.id,
      companyId: user.recruiterProfile!.companyId,
      email: seed.email,
    });
  }
  const demoRecruiter = recruiters[0]!;

  console.log("Creating drives and rounds…");
  const acme = companyMap.get("acme-cloud")!;
  const byteworks = companyMap.get("byteworks")!;
  const dataforge = companyMap.get("dataforge")!;
  const finedge = companyMap.get("finedge")!;
  const orbit = companyMap.get("orbit-labs")!;
  const greengrid = companyMap.get("greengrid")!;
  const helix = companyMap.get("helix-health")!;
  const pixelworks = companyMap.get("pixelworks")!;

  type DriveSeed = {
    company: { id: string; name: string; tier: number };
    title: string;
    roleTitle: string;
    package: number;
    tier: number;
    status: string;
    location: string;
    deadline: Date;
    openings: number;
    source: string;
    createdById: string;
    approvedById?: string;
    approvedAt?: Date;
    description: string;
    rules: { minCgpa?: number; maxBacklogs?: number; branches: string[]; years: number[]; requireVerified?: boolean; requireResume?: boolean };
    skills: [string, number, number, boolean][];
    rounds: { name: string; type: string; scheduleOffset?: number; duration?: number; venue?: string; meetingLink?: string; status?: string }[];
  };

  const driveSeeds: DriveSeed[] = [
    {
      company: acme,
      title: "Acme Cloud — Software Engineer 2026",
      roleTitle: "Software Engineer",
      package: 18,
      tier: 3,
      status: "ACTIVE",
      location: "Bengaluru",
      deadline: days(14),
      openings: 8,
      source: "OFFICER",
      createdById: officer.id,
      approvedById: officer.id,
      approvedAt: days(-10),
      description: "Build reliable cloud products with TypeScript, React, and Node.js. Strong fundamentals and clear communication matter more than buzzwords.",
      rules: { minCgpa: 7, maxBacklogs: 1, branches: ["CSE", "IT", "AIML"], years: [2026, 2027], requireVerified: true, requireResume: true },
      skills: [["typescript", 4, 3, true], ["react", 4, 2, true], ["node-js", 3, 2, true], ["postgresql", 3, 1, true], ["git", 3, 1, true], ["docker", 2, 1, false], ["communication", 3, 1, true]],
      rounds: [
        { name: "Online assessment", type: "APTITUDE", scheduleOffset: 5, duration: 60, meetingLink: "https://meet.example.com/acme-oa", status: "SCHEDULED" },
        { name: "Technical interview", type: "TECHNICAL", scheduleOffset: 9, duration: 45, venue: "Placement Cell — Lab 2", status: "PLANNED" },
        { name: "HR conversation", type: "HR", scheduleOffset: 12, duration: 30, venue: "Placement Cell — Room 4", status: "PLANNED" },
      ],
    },
    {
      company: byteworks,
      title: "ByteWorks — Backend Developer",
      roleTitle: "Backend Developer",
      package: 12,
      tier: 2,
      status: "ACTIVE",
      location: "Pune",
      deadline: days(9),
      openings: 6,
      source: "OFFICER",
      createdById: officer.id,
      approvedById: officer.id,
      approvedAt: days(-8),
      description: "Own APIs and data models for a fast-growing product engineering team.",
      rules: { minCgpa: 6.5, maxBacklogs: 2, branches: ["CSE", "IT"], years: [2026], requireVerified: true, requireResume: true },
      skills: [["java", 3, 2, true], ["spring-boot", 3, 2, true], ["postgresql", 3, 2, true], ["rest-apis", 3, 2, true], ["docker", 2, 1, false], ["problem-solving", 3, 1, true]],
      rounds: [
        { name: "Coding round", type: "TECHNICAL", scheduleOffset: 4, duration: 90, meetingLink: "https://meet.example.com/byteworks-coding", status: "SCHEDULED" },
        { name: "Technical deep dive", type: "TECHNICAL", scheduleOffset: 7, duration: 60, venue: "Pune office / video", status: "PLANNED" },
        { name: "HR round", type: "HR", scheduleOffset: 9, duration: 30, meetingLink: "https://meet.example.com/byteworks-hr", status: "PLANNED" },
      ],
    },
    {
      company: dataforge,
      title: "DataForge — Data Analyst",
      roleTitle: "Data Analyst",
      package: 10,
      tier: 2,
      status: "ACTIVE",
      location: "Hyderabad",
      deadline: days(18),
      openings: 4,
      source: "OFFICER",
      createdById: officer.id,
      approvedById: officer.id,
      approvedAt: days(-6),
      description: "Turn messy data into crisp decisions with SQL, Python, and strong storytelling.",
      rules: { minCgpa: 7.5, maxBacklogs: 0, branches: ["CSE", "IT", "AIML", "ECE"], years: [2026, 2027], requireVerified: true, requireResume: true },
      skills: [["python", 4, 3, true], ["sql", 4, 3, true], ["postgresql", 3, 1, false], ["presentation", 3, 1, true], ["problem-solving", 3, 1, true]],
      rounds: [
        { name: "SQL & analytics test", type: "APTITUDE", scheduleOffset: 8, duration: 75, meetingLink: "https://meet.example.com/dataforge-test", status: "SCHEDULED" },
        { name: "Case study", type: "TECHNICAL", scheduleOffset: 12, duration: 45, meetingLink: "https://meet.example.com/dataforge-case", status: "PLANNED" },
        { name: "HR round", type: "HR", scheduleOffset: 15, duration: 30, meetingLink: "https://meet.example.com/dataforge-hr", status: "PLANNED" },
      ],
    },
    {
      company: finedge,
      title: "FinEdge — Full Stack Engineer",
      roleTitle: "Full Stack Engineer",
      package: 14,
      tier: 2,
      status: "ACTIVE",
      location: "Mumbai",
      deadline: days(6),
      openings: 5,
      source: "OFFICER",
      createdById: officer.id,
      approvedById: officer.id,
      approvedAt: days(-5),
      description: "Ship customer-facing fintech experiences across React and Node.js.",
      rules: { minCgpa: 7, maxBacklogs: 1, branches: ["CSE", "IT", "AIML"], years: [2026], requireVerified: true, requireResume: true },
      skills: [["typescript", 3, 3, true], ["react", 3, 3, true], ["node-js", 3, 2, true], ["postgresql", 2, 1, false], ["communication", 3, 1, true]],
      rounds: [
        { name: "HackerRank assessment", type: "TECHNICAL", scheduleOffset: 3, duration: 90, meetingLink: "https://meet.example.com/finedge-assessment", status: "SCHEDULED" },
        { name: "Pair programming", type: "TECHNICAL", scheduleOffset: 6, duration: 60, venue: "Placement Cell — Lab 1", status: "PLANNED" },
      ],
    },
    {
      company: orbit,
      title: "Orbit Labs — DevOps Engineer",
      roleTitle: "DevOps Engineer",
      package: 9,
      tier: 1,
      status: "ACTIVE",
      location: "Remote",
      deadline: days(21),
      openings: 3,
      source: "OFFICER",
      createdById: officer.id,
      approvedById: officer.id,
      approvedAt: days(-3),
      description: "Automate deployments and keep developer tooling fast and boring.",
      rules: { minCgpa: 6, maxBacklogs: 2, branches: ["CSE", "IT", "ECE", "EEE"], years: [2026, 2027], requireVerified: false, requireResume: true },
      skills: [["linux", 3, 2, true], ["docker", 3, 2, true], ["git", 3, 1, true], ["aws", 2, 1, false], ["problem-solving", 3, 1, true]],
      rounds: [
        { name: "Screening call", type: "HR", scheduleOffset: 7, duration: 30, meetingLink: "https://meet.example.com/orbit-screen", status: "SCHEDULED" },
        { name: "Technical lab", type: "TECHNICAL", scheduleOffset: 10, duration: 60, meetingLink: "https://meet.example.com/orbit-lab", status: "PLANNED" },
      ],
    },
    {
      company: greengrid,
      title: "GreenGrid — Graduate Trainee",
      roleTitle: "Graduate Trainee",
      package: 6,
      tier: 1,
      status: "PENDING_APPROVAL",
      location: "Chennai",
      deadline: days(25),
      openings: 10,
      source: "RECRUITER",
      createdById: demoRecruiter.userId,
      description: "Rotational program across operations, analytics, and customer success.",
      rules: { minCgpa: 6, maxBacklogs: 3, branches: ["CSE", "IT", "ECE", "EEE", "MECH", "CIVIL", "AIML"], years: [2026, 2027], requireVerified: false, requireResume: false },
      skills: [["communication", 3, 2, true], ["problem-solving", 2, 1, true], ["sql", 2, 1, false]],
      rounds: [
        { name: "Aptitude test", type: "APTITUDE", scheduleOffset: 12, duration: 60, meetingLink: "https://meet.example.com/greengrid-test", status: "PLANNED" },
        { name: "Group discussion", type: "GD", scheduleOffset: 16, duration: 45, venue: "Placement Cell — Hall A", status: "PLANNED" },
      ],
    },
    {
      company: pixelworks,
      title: "PixelWorks — UI Engineer",
      roleTitle: "UI Engineer",
      package: 8,
      tier: 1,
      status: "DRAFT",
      location: "Remote",
      deadline: days(30),
      openings: 2,
      source: "OFFICER",
      createdById: officer.id,
      description: "Build polished, accessible interfaces for creative tools.",
      rules: { minCgpa: 6.5, maxBacklogs: 1, branches: ["CSE", "IT", "AIML"], years: [2026, 2027], requireVerified: false, requireResume: true },
      skills: [["react", 3, 2, true], ["tailwind-css", 3, 2, true], ["figma", 2, 1, false], ["communication", 3, 1, true]],
      rounds: [
        { name: "Portfolio review", type: "TECHNICAL", scheduleOffset: 10, duration: 45, meetingLink: "https://meet.example.com/pixelworks-portfolio", status: "PLANNED" },
        { name: "HR round", type: "HR", scheduleOffset: 14, duration: 30, meetingLink: "https://meet.example.com/pixelworks-hr", status: "PLANNED" },
      ],
    },
    {
      company: helix,
      title: "Helix Health — Software Engineer (2025 drive)",
      roleTitle: "Software Engineer",
      package: 7,
      tier: 1,
      status: "COMPLETED",
      location: "Bengaluru",
      deadline: days(-75),
      openings: 20,
      source: "OFFICER",
      createdById: officer.id,
      approvedById: officer.id,
      approvedAt: days(-120),
      description: "Completed campus drive for the health platform engineering team.",
      rules: { minCgpa: 6.5, maxBacklogs: 2, branches: ["CSE", "IT", "AIML", "ECE"], years: [2026], requireVerified: true, requireResume: true },
      skills: [["java", 2, 2, true], ["sql", 2, 2, true], ["communication", 2, 1, true]],
      rounds: [
        { name: "Aptitude", type: "APTITUDE", scheduleOffset: -65, duration: 60, venue: "Placement Cell", status: "COMPLETED" },
        { name: "Technical", type: "TECHNICAL", scheduleOffset: -55, duration: 45, venue: "Placement Cell", status: "COMPLETED" },
      ],
    },
  ];

  type DriveRecord = { id: string; seed: DriveSeed; rounds: { id: string; order: number; name: string }[]; requiredSkills: string[] };
  const driveRecords: DriveRecord[] = [];
  for (const seed of driveSeeds) {
    const drive = await prisma.drive.create({
      data: {
        companyId: seed.company.id,
        createdById: seed.createdById,
        approvedById: seed.approvedById ?? null,
        approvedAt: seed.approvedAt ?? null,
        title: seed.title,
        roleTitle: seed.roleTitle,
        description: seed.description,
        package: seed.package,
        location: seed.location,
        tier: seed.tier,
        openings: seed.openings,
        status: seed.status,
        source: seed.source,
        deadline: seed.deadline,
        publishedAt: seed.status === "DRAFT" ? null : seed.approvedAt ?? days(-1),
        closedAt: seed.status === "COMPLETED" ? days(-60) : null,
        eligibilityRule: {
          create: {
            minCgpa: seed.rules.minCgpa ?? null,
            maxBacklogs: seed.rules.maxBacklogs ?? null,
            allowedBranches: seed.rules.branches.join(","),
            allowedGraduationYears: seed.rules.years.join(","),
            requireVerifiedProfile: seed.rules.requireVerified ?? true,
            requireResume: seed.rules.requireResume ?? true,
          },
        },
      },
    });
    await prisma.driveRequiredSkill.createMany({
      data: seed.skills.map(([slug, minProficiency, weight, isMandatory]) => ({
        driveId: drive.id,
        skillId: skills.get(slug)!.id,
        minProficiency,
        weight,
        isMandatory,
      })),
    });
    const roundRecords = [];
    for (let index = 0; index < seed.rounds.length; index++) {
      const round = seed.rounds[index]!;
      const created = await prisma.round.create({
        data: {
          driveId: drive.id,
          name: round.name,
          type: round.type,
          order: index + 1,
          durationMinutes: round.duration ?? null,
          scheduledAt: round.scheduleOffset !== undefined ? days(round.scheduleOffset) : null,
          venue: round.venue ?? null,
          meetingLink: round.meetingLink ?? null,
          status: round.status ?? "PLANNED",
        },
      });
      roundRecords.push({ id: created.id, order: created.order, name: created.name });
    }
    driveRecords.push({
      id: drive.id,
      seed,
      rounds: roundRecords,
      requiredSkills: seed.skills.map(([slug]) => slug),
    });
  }

  const activeDrives = driveRecords.filter((drive) => drive.seed.status === "ACTIVE");
  const completedDrive = driveRecords.find((drive) => drive.seed.status === "COMPLETED")!;
  const demoStudent = students[0]!;
  const ineligibleStudent = students[1]!;
  const placedStudent = students[2]!;

  console.log("Creating applications and round results…");
  const usedPairs = new Set<string>();
  const applications: { id: string; studentProfileId: string; driveId: string; status: string; currentRoundId: string | null }[] = [];

  async function createApplication(
    student: StudentRecord,
    drive: DriveRecord,
    status: string,
    source = "STUDENT",
    options: { matchScore?: number; isDreamOffer?: boolean } = {},
  ) {
    const key = `${student.profileId}:${drive.id}`;
    if (usedPairs.has(key)) return null;
    usedPairs.add(key);
    const activeStatuses = ["APPLIED", "SHORTLISTED", "IN_PROCESS", "OFFERED"];
    const currentRound =
      status === "SHORTLISTED" || status === "IN_PROCESS" || status === "OFFERED"
        ? drive.rounds[status === "SHORTLISTED" ? 0 : Math.min(1, drive.rounds.length - 1)]?.id ?? null
        : null;
    const application = await prisma.application.create({
      data: {
        studentProfileId: student.profileId,
        driveId: drive.id,
        status,
        source,
        currentRoundId: currentRound,
        coverNote: random() < 0.4 ? "Excited about the role and the team's product direction." : null,
        matchScore: options.matchScore ?? randInt(55, 98),
        isDreamOffer: options.isDreamOffer ?? false,
        eligibilitySnapshot: JSON.stringify({
          version: 1,
          eligible: true,
          matchScore: options.matchScore ?? randInt(55, 98),
          evaluatedAt: new Date().toISOString(),
          source: "seed",
        }),
        appliedAt: days(-randInt(1, 20)),
        statusUpdatedAt: days(-randInt(0, 3)),
        withdrawnAt: status === "WITHDRAWN" ? days(-2) : null,
        rejectionReason: status === "REJECTED" ? "Did not clear the technical round." : null,
        recruiterFeedback: status === "OFFERED" ? "Strong fundamentals and clear communication." : null,
      },
    });
    applications.push({
      id: application.id,
      studentProfileId: student.profileId,
      driveId: drive.id,
      status,
      currentRoundId: currentRound,
    });

    if (currentRound) {
      const roundIndex = drive.rounds.findIndex((round) => round.id === currentRound);
      const resultRows = drive.rounds.slice(0, roundIndex + 1).map((round, index) => {
        const isCurrent = round.id === currentRound;
        return {
          applicationId: application.id,
          roundId: round.id,
          status: isCurrent ? (status === "IN_PROCESS" ? "PENDING" : "SCHEDULED") : "PASSED",
          score: !isCurrent ? randInt(60, 95) : null,
          feedback: !isCurrent ? "Cleared with positive feedback." : null,
          resultAt: !isCurrent ? days(-randInt(2, 8)) : null,
        };
      });
      await prisma.applicationRoundResult.createMany({ data: resultRows });
    }
    if (activeStatuses.includes(status) && status !== "APPLIED") {
      const studentUser = students.find((s) => s.profileId === student.profileId);
      if (studentUser) {
        await prisma.notification.create({
          data: {
            userId: studentUser.userId,
            type: "APPLICATION_STATUS",
            title: `${drive.seed.title}: ${status.replaceAll("_", " ").toLowerCase()}`,
            body: `Your application for ${drive.seed.roleTitle} at ${drive.seed.company.name} is now ${status.replaceAll("_", " ").toLowerCase()}.`,
            link: `/student/applications/${application.id}`,
            isRead: random() < 0.5,
            dedupeKey: `seed-app-${application.id}`,
            createdAt: days(-randInt(0, 5)),
          },
        });
      }
    }
    return application;
  }

  for (const drive of activeDrives) {
    const eligiblePool = students.filter(
      (student) =>
        student.profileId !== demoStudent.profileId &&
        student.profileId !== ineligibleStudent.profileId &&
        student.profileId !== placedStudent.profileId &&
        student.cgpa >= (drive.seed.rules.minCgpa ?? 0) &&
        student.backlogs <= (drive.seed.rules.maxBacklogs ?? 99) &&
        drive.seed.rules.branches.includes(student.branch) &&
        drive.seed.rules.years.includes(student.graduationYear),
    );
    const count = Math.min(eligiblePool.length, drive.seed.company.id === acme.id ? 38 : randInt(28, 38));
    const shuffled = [...eligiblePool].sort(() => random() - 0.5).slice(0, count);
    for (let index = 0; index < shuffled.length; index++) {
      const student = shuffled[index]!;
      const roll = random();
      const status = roll < 0.42 ? "APPLIED" : roll < 0.63 ? "SHORTLISTED" : roll < 0.83 ? "IN_PROCESS" : roll < 0.92 ? "REJECTED" : "WITHDRAWN";
      await createApplication(student, drive, status);
    }
  }

  for (let index = 0; index < 40; index++) {
    const student = students[index + 5]!;
    if (!student) continue;
    const roll = random();
    const status = index < 29 ? "OFFERED" : roll < 0.6 ? "REJECTED" : "IN_PROCESS";
    await createApplication(student, completedDrive, status, "STUDENT", { matchScore: randInt(62, 94) });
  }

  await createApplication(demoStudent, activeDrives[0]!, "APPLIED", "STUDENT", { matchScore: 92 });
  await createApplication(demoStudent, activeDrives[1]!, "IN_PROCESS", "STUDENT", { matchScore: 84 });
  await createApplication(demoStudent, activeDrives[3]!, "SHORTLISTED", "STUDENT", { matchScore: 88 });
  await createApplication(ineligibleStudent, activeDrives[4]!, "APPLIED", "STUDENT", { matchScore: 45 });
  await createApplication(placedStudent, completedDrive, "OFFERED", "STUDENT", { matchScore: 81 });
  const placedApplication = applications.find(
    (application) => application.studentProfileId === placedStudent.profileId && application.driveId === completedDrive.id,
  );

  console.log("Creating offers…");
  const offerCandidates = applications
    .filter((application) => application.status === "OFFERED")
    .filter((application, index, list) => list.findIndex((a) => a.studentProfileId === application.studentProfileId) === index)
    .slice(0, 40);
  for (const application of offerCandidates) {
    const drive = driveRecords.find((record) => record.id === application.driveId)!;
    await prisma.offer.create({
      data: {
        applicationId: application.id,
        studentProfileId: application.studentProfileId,
        package: drive.seed.package,
        roleTitle: drive.seed.roleTitle,
        location: drive.seed.location,
        tier: drive.seed.tier,
        status: "ACCEPTED",
        offerDate: days(-randInt(3, 45)),
        joiningDate: days(randInt(90, 180)),
        notes: "Offer issued after successful completion of all rounds.",
        createdById: officer.id,
      },
    });
  }
  if (placedApplication) {
    await prisma.offer.upsert({
      where: { applicationId: placedApplication.id },
      update: {},
      create: {
        applicationId: placedApplication.id,
        studentProfileId: placedApplication.studentProfileId,
        package: completedDrive.seed.package,
        roleTitle: completedDrive.seed.roleTitle,
        location: completedDrive.seed.location,
        tier: completedDrive.seed.tier,
        status: "ACCEPTED",
        offerDate: days(-50),
        joiningDate: days(120),
        createdById: officer.id,
      },
    });
  }

  console.log("Creating notifications, saved candidates and audit log…");
  const demoUser = students[0]!;
  const notificationSeeds = [
    ["DRIVE_NEW_ELIGIBLE", "New drive: Acme Cloud Software Engineer", "You are eligible for Acme Cloud — Software Engineer 2026. The application deadline is in 14 days.", `/student/drives/${activeDrives[0]!.id}`],
    ["ROUND_SCHEDULED", "ByteWorks coding round scheduled", "Your coding round is scheduled. Check the application tracker for the meeting link and time.", `/student/applications/${applications.find((a) => a.studentProfileId === demoUser.profileId && a.driveId === activeDrives[1]!.id)?.id ?? ""}`],
    ["APPLICATION_STATUS", "FinEdge shortlisted you", "Your application for Full Stack Engineer at FinEdge has moved to Shortlisted.", `/student/applications/${applications.find((a) => a.studentProfileId === demoUser.profileId && a.driveId === activeDrives[3]!.id)?.id ?? ""}`],
    ["SKILL_VERIFIED", "Skill verification complete", "The placement office verified your TypeScript, React, and PostgreSQL claims.", "/student/skills"],
    ["PROFILE_VERIFIED", "Profile verified", "Your academic profile has been verified. Drives that require verification are now available.", "/student/profile"],
    ["SYSTEM", "Complete your profile", "Adding both GitHub and LinkedIn links improves your profile completeness score.", "/student/profile"],
  ] as const;
  for (let index = 0; index < notificationSeeds.length; index++) {
    const [type, title, body, link] = notificationSeeds[index]!;
    await prisma.notification.create({
      data: {
        userId: demoUser.userId,
        type,
        title,
        body,
        link,
        isRead: index > 3,
        dedupeKey: `seed-demo-notification-${index}`,
        createdAt: days(-index),
      },
    });
  }
  for (let index = 0; index < 8; index++) {
    await prisma.notification.create({
      data: {
        userId: officer.id,
        type: index === 0 ? "DRIVE_APPROVAL" : "SYSTEM",
        title: index === 0 ? "Drive awaiting approval: GreenGrid" : `Placement update ${index}`,
        body: index === 0 ? "A recruiter requested a new drive. Review eligibility rules before publishing." : "A recent placement action was recorded in the audit log.",
        link: index === 0 ? "/officer/approvals" : "/officer/audit",
        isRead: index > 2,
        dedupeKey: `seed-officer-notification-${index}`,
        createdAt: days(-index),
      },
    });
  }
  const recruiterUser = await prisma.user.findUnique({ where: { email: demoRecruiter.email } });
  if (recruiterUser) {
    for (let index = 0; index < 6; index++) {
      await prisma.notification.create({
        data: {
          userId: recruiterUser.id,
          type: "APPLICATION_STATUS",
          title: `New applicant ${index + 1} for Acme Cloud`,
          body: "A student applied to your Software Engineer drive. Review their verified profile and resume.",
          link: `/recruiter/drives/${activeDrives[0]!.id}`,
          isRead: index > 3,
          dedupeKey: `seed-recruiter-notification-${index}`,
          createdAt: days(-index),
        },
      });
    }
  }

  for (let index = 0; index < 3; index++) {
    await prisma.savedCandidate.create({
      data: {
        recruiterProfileId: demoRecruiter.profileId,
        studentProfileId: students[index + 10]!.profileId,
        note: index === 0 ? "Strong React portfolio." : null,
      },
    });
  }

  const auditActions = [
    "STUDENT_VERIFIED",
    "SKILL_VERIFIED",
    "DRIVE_PUBLISHED",
    "DRIVE_CREATED",
    "APPLICATION_STATUS_CHANGED",
    "OFFER_RECORDED",
    "ELIGIBILITY_OVERRIDE",
    "STUDENTS_IMPORTED",
    "POLICY_UPDATED",
    "REPORT_EXPORTED",
  ];
  for (let index = 0; index < 120; index++) {
    await prisma.auditLog.create({
      data: {
        actorId: index % 3 === 0 ? recruiterUser?.id ?? officer.id : officer.id,
        action: auditActions[index % auditActions.length]!,
        entityType: index % 2 === 0 ? "Drive" : "StudentProfile",
        entityId: index % 2 === 0 ? activeDrives[index % activeDrives.length]!.id : students[index % students.length]!.profileId,
        metadataJson: JSON.stringify({ seed: true, index }),
        createdAt: days(-index / 3),
      },
    });
  }

  await prisma.notification.create({
    data: {
      userId: officer.id,
      type: "DRIVE_NEW_ELIGIBLE",
      title: "Eligibility run complete",
      body: `Eligibility was evaluated for all 50 students across ${activeDrives.length} active drives.`,
      link: "/officer/reports",
      dedupeKey: "seed-eligibility-run",
      createdAt: days(-1),
    },
  });

  const counts = {
    users: await prisma.user.count(),
    students: await prisma.studentProfile.count(),
    companies: await prisma.company.count(),
    recruiters: await prisma.recruiterProfile.count(),
    skills: await prisma.skill.count(),
    drives: await prisma.drive.count(),
    applications: await prisma.application.count(),
    offers: await prisma.offer.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
    studentSkills: await prisma.studentSkill.count(),
    skillHistory: await prisma.skillHistory.count(),
  };

  if (counts.students < 50) throw new Error("Seed failed: expected at least 50 students");
  if (counts.companies !== 10) throw new Error("Seed failed: expected 10 companies");
  if (counts.skills < 60) throw new Error("Seed failed: expected at least 60 skills");
  if (counts.drives !== 8) throw new Error("Seed failed: expected 8 drives");
  if (counts.applications < 150) throw new Error("Seed failed: expected at least 150 applications");

  console.log("Seed complete:", counts);
  console.log("Demo logins:");
  console.log("  Student   student@campus.test / Student@123");
  console.log("  Officer   officer@campus.test / Officer@123");
  console.log("  Recruiter recruiter@campus.test / Recruiter@123");
  console.log(`  Resume fixture: ${resumePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
