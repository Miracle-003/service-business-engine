import { z } from "zod";
import { ApiError } from "@/src/server/api/errors";

export const uuidSchema = z.uuid();

export function parseSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiError(422, "VALIDATION_ERROR", "Invalid request input", result.error.flatten());
  }

  return result.data;
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ApiError(422, "VALIDATION_ERROR", "Request body must be valid JSON");
  }

  return parseSchema(schema, body);
}
