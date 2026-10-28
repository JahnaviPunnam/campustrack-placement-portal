"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadResumeAction } from "@/server/actions/student";
import { formatDate } from "@/lib/formatting";

type ResumeUploaderProps = {
  profileId: string;
  fileName: string | null;
  updatedAt: string | null;
  sizeBytes: number | null;
};

export function ResumeUploader({ profileId, fileName, updatedAt, sizeBytes }: ResumeUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resume must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }
    const data = new FormData();
    data.append("resume", file);
    setUploading(true);
    const result = await uploadResumeAction(data);
    setUploading(false);
    event.target.value = "";
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Resume uploaded.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={pick}
      />
      {fileName ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              Updated {formatDate(updatedAt)}
              {sizeBytes ? ` · ${(sizeBytes / 1024).toFixed(0)} KB` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={`/api/resumes/${profileId}`} target="_blank" rel="noreferrer">
                  View PDF
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                Replace
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No resume uploaded. Many drives require one, so upload a current PDF.
        </p>
      )}
      <Button
        type="button"
        variant={fileName ? "outline" : "default"}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {uploading ? "Uploading…" : "Upload PDF"}
      </Button>
      <p className="text-xs text-muted-foreground">PDF only · maximum 5 MB · stored privately.</p>
    </div>
  );
}
