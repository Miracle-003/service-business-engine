import { z } from "zod";

export const uuidSchema = z.uuid();

export const decimalStringSchema = z
  .string()
  .regex(/^-?[0-9]+(\.[0-9]{1,2})?$/, "Invalid decimal format");

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
