import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { roleHome } from "@/lib/roles";
import type { Role } from "@/lib/constants";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(roleHome(user.role as Role));

  const [students, skills, companies, drives] = await Promise.all([
    prisma.studentProfile.count(),
    prisma.skill.count({ where: { isActive: true } }),
    prisma.company.count({ where: { isActive: true } }),
    prisma.drive.count({ where: { status: "ACTIVE" } }),
  ]);

  return (
    <div className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <GraduationCap className="h-5 w-5" />
          </span>
          CampusTrack
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-7xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <div className="hero-grid pointer-events-none absolute inset-0 -z-10" />
          <div className="absolute left-1/2 top-0 -z-10 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
          <Badge variant="secondary" className="mb-6 gap-2 px-4 py-1.5 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Skills, eligibility, and placements in one place
          </Badge>
          <h1 className="mx-auto max-w-4xl text-balance text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Placement season, <span className="text-primary">without the spreadsheet chaos.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Students track real skills. Officers automate eligibility and rounds. Recruiters find
            verified talent by skill — all with live updates.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full gap-2 sm:w-auto">
              <Link href="/login">
                Explore demo accounts <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/register">Create a student account</Link>
            </Button>
          </div>

          <dl className="mx-auto mt-14 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Students", value: students, icon: Users },
              { label: "Skills tracked", value: skills, icon: Sparkles },
              { label: "Companies", value: companies, icon: BriefcaseBusiness },
              { label: "Active drives", value: drives, icon: CheckCircle2 },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border bg-card/70 p-5 backdrop-blur">
                <stat.icon className="mx-auto mb-2 h-4 w-4 text-primary" />
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-semibold">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: GraduationCap,
              title: "For students",
              text: "Build a verified skill profile, see exactly why you are eligible or not, and follow every interview round in real time.",
              points: ["Skill progress timeline", "Exact eligibility reasons", "Live application pipeline"],
            },
            {
              icon: ShieldCheck,
              title: "For placement officers",
              text: "Automate CGPA and skill cutoffs, move candidates through rounds in bulk, and export audit-ready reports.",
              points: ["Pure, tested eligibility engine", "Bulk shortlisting", "CSV/PDF reports"],
            },
            {
              icon: BarChart3,
              title: "For recruiters",
              text: "Search verified candidates by skill and proficiency, shortlist for your drives, and leave structured feedback.",
              points: ["AND/OR skill search", "Ranked matches", "Company-scoped access"],
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border bg-card p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="border-y bg-muted/40 py-16">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-2">
            <div>
              <Badge variant="outline" className="mb-3">Built for real placement cells</Badge>
              <h2 className="text-3xl font-bold tracking-tight">One source of truth for every stakeholder.</h2>
              <p className="mt-4 text-muted-foreground">
                Eligibility is computed by a pure, unit-tested engine. Every officer override is
                audited. Notifications are persisted before they are streamed, so nobody misses a
                shortlist or interview slot.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: BellRing, title: "Live updates", text: "SSE with polling fallback" },
                { icon: ShieldCheck, title: "RBAC everywhere", text: "Guards on every action" },
                { icon: BarChart3, title: "Analytics", text: "Demand vs supply heatmap" },
                { icon: Users, title: "Verified profiles", text: "Officer-approved skills" },
              ].map((item) => (
                <div key={item.title} className="flex gap-3 rounded-xl border bg-card p-4">
                  <item.icon className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>CampusTrack · Student Skill Tracker & Placement Portal</p>
        <p>Next.js · Prisma · SQLite · Auth.js</p>
      </footer>
    </div>
  );
}
