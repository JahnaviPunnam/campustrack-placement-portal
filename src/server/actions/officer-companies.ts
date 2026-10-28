"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/action-result";
import {
  companySchema,
  companyStatusSchema,
  companyUpdateSchema,
  policyUpdateSchema,
  recruiterCreateSchema,
  recruiterResetSchema,
  recruiterStatusSchema,
} from "@/lib/validation/officer";
import { requireOfficer } from "@/server/auth/guards";
import {
  createCompany,
  createRecruiter,
  resetRecruiterPassword,
  setCompanyActive,
  setRecruiterActive,
  updateCompany,
  updatePlacementPolicy,
} from "@/server/services/officer-companies";

function revalidateCompanies(companyId?: string) {
  revalidatePath("/officer/companies");
  revalidatePath("/officer");
  if (companyId) revalidatePath(`/officer/companies/${companyId}`);
}

export async function createCompanyAction(
  input: unknown,
): Promise<ActionResult<{ companyId: string }>> {
  try {
    const officer = await requireOfficer();
    const data = companySchema.parse(input);
    const company = await createCompany(data, officer.id);
    revalidateCompanies(company.id);
    return actionOk({ companyId: company.id });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCompanyAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = companyUpdateSchema.parse(input);
    await updateCompany(data, officer.id);
    revalidateCompanies(data.companyId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function setCompanyStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = companyStatusSchema.parse(input);
    await setCompanyActive(data.companyId, data.isActive, officer.id);
    revalidateCompanies(data.companyId);
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function createRecruiterAction(
  input: unknown,
): Promise<ActionResult<{ email: string; password: string }>> {
  try {
    const officer = await requireOfficer();
    const data = recruiterCreateSchema.parse(input);
    const result = await createRecruiter(data, officer.id);
    revalidateCompanies(data.companyId);
    return actionOk({ email: result.email, password: result.password });
  } catch (error) {
    return actionError(error);
  }
}

export async function resetRecruiterPasswordAction(
  input: unknown,
): Promise<ActionResult<{ email: string; password: string }>> {
  try {
    const officer = await requireOfficer();
    const data = recruiterResetSchema.parse(input);
    const result = await resetRecruiterPassword(data.recruiterProfileId, officer.id);
    revalidateCompanies();
    return actionOk(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function setRecruiterStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = recruiterStatusSchema.parse(input);
    await setRecruiterActive(data.recruiterProfileId, data.isActive, officer.id);
    revalidateCompanies();
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePolicyAction(input: unknown): Promise<ActionResult> {
  try {
    const officer = await requireOfficer();
    const data = policyUpdateSchema.parse(input);
    await updatePlacementPolicy(data, officer.id);
    revalidatePath("/officer/policies");
    revalidatePath("/officer");
    return actionOk(undefined);
  } catch (error) {
    return actionError(error);
  }
}
