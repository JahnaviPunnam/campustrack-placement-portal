import { NextResponse } from "next/server";
import { AppError, isAppError } from "@/server/errors";
import type { SessionUser } from "@/server/auth/guards";
import { requireOfficer, requireUser } from "@/server/auth/guards";

export function apiErrorResponse(error: unknown): NextResponse {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  console.error("Unexpected API error", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

export async function requireOfficerApi(): Promise<
  { officer: SessionUser; response: null } | { officer: null; response: NextResponse }
> {
  try {
    const officer = await requireOfficer();
    return { officer, response: null };
  } catch (error) {
    return { officer: null, response: apiErrorResponse(error) };
  }
}


export async function requireShortlistExportApi(): Promise<
  | { user: SessionUser; companyId: string | null; response: null }
  | { user: null; companyId: null; response: NextResponse }
> {
  try {
    const user = await requireUser();
    if (user.role === "PLACEMENT_OFFICER") {
      return { user, companyId: null, response: null };
    }
    if (user.role === "RECRUITER") {
      if (!user.recruiterProfile) {
        throw new AppError("PROFILE_MISSING", "Recruiter profile is missing.", 404);
      }
      if (!user.recruiterProfile.company.isActive) {
        throw new AppError("COMPANY_INACTIVE", "This company account is inactive.", 403);
      }
      return { user, companyId: user.recruiterProfile.companyId, response: null };
    }
    throw new AppError("FORBIDDEN", "You do not have permission to export shortlists.", 403);
  } catch (error) {
    return { user: null, companyId: null, response: apiErrorResponse(error) };
  }
}
