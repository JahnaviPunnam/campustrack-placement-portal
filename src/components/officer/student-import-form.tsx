"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importStudentsAction } from "@/server/actions/officer-students";

const TEMPLATE = `name,email,rollNumber,branch,graduationYear,cgpa,backlogs,phone
Asha Rao,asha.rao@example.edu,CSE2026001,CSE,2026,8.7,0,9876543210
Rohan Mehta,rohan.mehta@example.edu,IT2026002,IT,2026,7.9,1,9876543211`;

type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  credentials: { row: number; email: string; password: string }[];
  errors: { row: number; message: string }[];
};

export function StudentImportForm() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("CSV must be 2 MB or smaller.");
      return;
    }
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setResult(null);
    setError(null);
  }

  async function submit() {
    setLoading(true);
    setError(null);
    const response = await importStudentsAction({ csv });
    setLoading(false);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    setResult(response.data);
    toast.success(
      `Import complete: ${response.data.created} created, ${response.data.updated} updated.`,
    );
    router.refresh();
  }

  function downloadCredentials() {
    if (!result?.credentials.length) return;
    const lines = ["row,email,temporaryPassword"];
    for (const credential of result.credentials) {
      lines.push(
        `${credential.row},"${credential.email.replaceAll('"', '""')}","${credential.password.replaceAll('"', '""')}"`,
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "campus-import-credentials.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="csv-file">CSV file</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <label htmlFor="csv-file" className="cursor-pointer">
              <FileUp className="h-4 w-4" /> Choose file
            </label>
          </Button>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <span className="text-sm text-muted-foreground">
            {fileName ?? "No file selected (you can paste below instead)"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="csv-text">CSV content</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCsv(TEMPLATE);
              setFileName("template.csv");
            }}
          >
            Load template
          </Button>
        </div>
        <Textarea
          id="csv-text"
          value={csv}
          onChange={(event) => {
            setCsv(event.target.value);
            setFileName(null);
          }}
          rows={12}
          className="font-mono text-xs"
          placeholder="Paste CSV rows here…"
        />
        <p className="text-xs text-muted-foreground">
          Header aliases are accepted. Existing roll numbers are updated and their verification is
          reset. New accounts receive a one-time password and must change it on first login.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="button" onClick={submit} disabled={loading || !csv.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {loading ? "Importing…" : "Import students"}
      </Button>

      {result ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Summary label="Created" value={result.created} />
            <Summary label="Updated" value={result.updated} />
            <Summary label="Failed rows" value={result.failed} destructive={result.failed > 0} />
          </div>

          {result.credentials.length > 0 ? (
            <Alert variant="warning">
              <FileUp className="h-4 w-4" />
              <AlertTitle>One-time credentials</AlertTitle>
              <AlertDescription>
                These passwords are shown once. Download and share them securely.
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3 flex"
                  onClick={downloadCredentials}
                >
                  <Download className="h-4 w-4" /> Download credentials CSV
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {result.errors.length > 0 ? (
            <div className="rounded-lg border">
              <div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">Row errors</div>
              <div className="max-h-72 divide-y overflow-y-auto">
                {result.errors.map((rowError) => (
                  <div key={`${rowError.row}-${rowError.message}`} className="flex gap-3 px-4 py-2 text-sm">
                    <span className="font-mono text-muted-foreground">Row {rowError.row}</span>
                    <span>{rowError.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Summary({
  label,
  value,
  destructive = false,
}: {
  label: string;
  value: number;
  destructive?: boolean;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={destructive ? "mt-1 text-2xl font-bold text-destructive" : "mt-1 text-2xl font-bold"}>
        {value}
      </p>
    </div>
  );
}
