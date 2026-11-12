import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "DATABASE_ERROR" | "NO_VALID_ASSIGNMENT" | "INTERNAL_ERROR";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function apiError(code: ApiErrorCode, message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) return apiError("BAD_REQUEST", "입력값을 확인해 주세요.", 400, error.flatten());
  if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
  console.error("API error", error instanceof Error ? error.message : "unknown");
  return apiError("INTERNAL_ERROR", "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
}

export class AuthError extends Error {
  constructor(public code: "UNAUTHORIZED" | "FORBIDDEN", message: string, public status: 401 | 403) { super(message); }
}

