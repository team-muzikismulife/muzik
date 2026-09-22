import { DateKeySchema, DocumentIdSchema } from '@/schemas';

// Query keys may repeat. Match URLSearchParams.get by consistently using the first value.
export function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function isRouteId(value: string | undefined): value is string {
  return DocumentIdSchema.safeParse(value).success;
}

export function isRouteDate(value: string): boolean {
  if (!DateKeySchema.safeParse(value).success) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
