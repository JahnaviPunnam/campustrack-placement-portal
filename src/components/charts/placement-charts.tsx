"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { funnelConversion, heatmapIntensity } from "@/lib/reporting";

const COLORS = ["#0f766e", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#64748b"];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

export function BranchPlacementChart({
  data,
}: {
  data: { branch: string; total: number; placed: number; rate: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="branch" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="total" name="Students" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="placed" name="Placed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ApplicationStatusChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          type="category"
          dataKey="status"
          width={82}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
          tickFormatter={(value: string) => value.replaceAll("_", " ").toLowerCase()}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" name="Applications" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CompanyOffersChart({
  data,
}: {
  data: { company: string; offers: number; averagePackage: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 42, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          type="category"
          dataKey="company"
          width={110}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="offers" name="Offers" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyOffersChart({ data }: { data: { label: string; offers: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="offers" name="Offers" stroke="hsl(var(--primary))" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TierPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}


export function SkillDemandHeatmap({
  data,
  maxSupply,
  maxDemand,
}: {
  data: { name: string; category: string; supply: number; demand: number; coverage: number | null }[];
  maxSupply: number;
  maxDemand: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 font-medium">Skill</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 text-right font-medium">Supply</th>
            <th className="px-3 py-2 text-right font-medium">Demand</th>
            <th className="px-3 py-2 text-right font-medium">Students / requirement</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row) => (
            <tr key={row.name}>
              <td className="py-2 pr-3 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-xs capitalize text-muted-foreground">
                {row.category.replaceAll("-", " ")}
              </td>
              <td
                className="px-3 py-2 text-right"
                style={{ backgroundColor: `hsl(var(--primary) / ${heatmapIntensity(row.supply, maxSupply) * 0.22})` }}
              >
                {row.supply}
              </td>
              <td
                className="px-3 py-2 text-right"
                style={{ backgroundColor: `hsl(38 92% 50% / ${heatmapIntensity(row.demand, maxDemand) * 0.22})` }}
              >
                {row.demand}
              </td>
              <td className="px-3 py-2 text-right">
                {row.coverage === null ? "—" : row.coverage.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TopDemandSkills({
  data,
}: {
  data: { name: string; supply: number; demand: number; coverage: number | null }[];
}) {
  const max = data.reduce((value, row) => Math.max(value, row.demand), 0);
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No drive skill requirements in this scope.</p>;
  }
  return (
    <div className="space-y-3">
      {data.map((row, index) => (
        <div key={row.name}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
              <span className="truncate font-medium">{row.name}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {row.demand} drive requirement{row.demand === 1 ? "" : "s"} · {row.supply} student
              {row.supply === 1 ? "" : "s"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${max > 0 ? Math.max(4, (row.demand / max) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DriveFunnelChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No funnel stages available.</p>;
  }
  const applied = data[0]?.count ?? 0;
  const chartData = data.map((stage) => ({
    ...stage,
    conversion: funnelConversion(stage.count, applied),
  }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 46)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          type="category"
          dataKey="label"
          width={140}
          tick={{ fontSize: 10 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="count" name="Candidates" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
