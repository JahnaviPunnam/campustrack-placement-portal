"use client";

import { useState } from "react";
import { ExportButton } from "@/components/shared/export-button";
import { Select } from "@/components/ui/select";

export function ShortlistExportControls({
  driveId,
  rounds,
}: {
  driveId: string;
  rounds: { id: string; name: string; order: number }[];
}) {
  const [roundId, setRoundId] = useState("");
  const query = new URLSearchParams({ driveId });
  if (roundId) query.set("roundId", roundId);

  return (
    <div className="space-y-3">
      <Select value={roundId} onChange={(event) => setRoundId(event.target.value)} aria-label="Shortlist round">
        <option value="">All shortlisted candidates</option>
        {rounds.map((round) => (
          <option key={round.id} value={round.id}>
            Round {round.order}: {round.name}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap gap-2">
        <ExportButton
          url={`/api/exports/shortlists?${query.toString()}&format=csv`}
          label="Shortlist CSV"
          format="csv"
        />
        <ExportButton
          url={`/api/exports/shortlists?${query.toString()}&format=pdf`}
          label="Shortlist PDF"
          format="pdf"
        />
      </div>
    </div>
  );
}
