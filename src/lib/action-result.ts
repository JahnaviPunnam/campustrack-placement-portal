import { ZodError } from "zod";
import { isAppError } from "@/server/errors";

export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error: { code, message, fieldErrors } };
}

export function actionError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    const fieldErrors = Object.fromEntries(
      Object.entries(error.flatten().fieldErrors).filter((entry): entry is [string, string[]] =>
        Array.isArray(entry[1]),
      ),
    );
    return actionFail("VALIDATION_ERROR", "Please check the highlighted fields.", fieldErrors);
  }
  if (isAppError(error)) {
    return actionFail(error.code, error.message, error.fieldErrors);
  }
  console.error("Unexpected action error", error);
  return actionFail("INTERNAL_ERROR", "Something went wrong. Please try again.");
}
