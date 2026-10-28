import Link from "next/link";
import { Download, History, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDateTime } from "@/lib/formatting";
import { listAuditLogs } from "@/server/services/officer-admin";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page?: string;
};

function buildQuery(params: SearchParams, overrides: Partial<SearchParams> = {}) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `?${query}` : "";
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Number.isInteger(Number(searchParams.page)) ? Number(searchParams.page) : 1;
  const data = await listAuditLogs({
    q: searchParams.q?.trim() || undefined,
    action: searchParams.action || undefined,
    entityType: searchParams.entityType || undefined,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
    page,
  });

  return (
    <div>
      <PageHeader
        title="Audit log"
        description={`${data.total} privileged action${data.total === 1 ? "" : "s"} recorded.`}
        actions={
          <Button asChild variant="outline">
            <a href={`/api/officer/audit/export${buildQuery(searchParams, { page: undefined })}`}>
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_0.8fr_0.8fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Actor, action or entity"
                className="pl-9"
              />
            </div>
            <Select name="action" defaultValue={searchParams.action ?? ""}>
              <option value="">All actions</option>
              {data.actions.map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </Select>
            <Select name="entityType" defaultValue={searchParams.entityType ?? ""}>
              <option value="">All entities</option>
              {data.entityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {entityType}
                </option>
              ))}
            </Select>
            <Input name="from" type="date" defaultValue={searchParams.from ?? ""} />
            <Input name="to" type="date" defaultValue={searchParams.to ?? ""} />
            <Button type="submit">Filter</Button>
            <Button asChild variant="ghost">
              <Link href="/officer/audit">Clear</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {data.logs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No audit entries"
          description="Privileged actions will appear here."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.logs.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-xs">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3">
                        <p>{log.actor?.name ?? "System"}</p>
                        <p className="text-xs text-muted-foreground">{log.actor?.email ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{log.action}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <p>{log.entityType}</p>
                        <p className="font-mono text-xs text-muted-foreground">{log.entityId ?? "—"}</p>
                      </td>
                      <td className="max-w-md px-4 py-3">
                        {log.beforeJson || log.afterJson || log.metadataJson ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted-foreground">View snapshot</summary>
                            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[11px]">
                              {[
                                log.beforeJson ? `before: ${log.beforeJson}` : null,
                                log.afterJson ? `after: ${log.afterJson}` : null,
                                log.metadataJson ? `metadata: ${log.metadataJson}` : null,
                              ]
                                .filter(Boolean)
                                .join("\n")}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.pageCount > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.pageCount}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/officer/audit${buildQuery(searchParams, { page: String(Math.max(1, data.page - 1)) })}`}>
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/officer/audit${buildQuery(searchParams, { page: String(Math.min(data.pageCount, data.page + 1)) })}`}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
