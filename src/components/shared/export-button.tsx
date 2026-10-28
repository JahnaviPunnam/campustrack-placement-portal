"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ExportButtonProps = {
  url: string;
  label: string;
  format: "csv" | "pdf";
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
};

function filenameFromResponse(response: Response, fallback: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

export function ExportButton({ url, label, format, variant = "outline", size = "sm" }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(payload?.error?.message ?? "Export failed. Please try again.");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filenameFromResponse(
        response,
        `${label.toLowerCase().replaceAll(" ", "-")}.${format}`,
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success(`${label} downloaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const Icon = format === "pdf" ? FileText : Download;
  return (
    <Button type="button" variant={variant} size={size} onClick={() => void download()} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
