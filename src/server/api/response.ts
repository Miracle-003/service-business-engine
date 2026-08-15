import { NextResponse } from "next/server";

export function ok(data: unknown) {
  return NextResponse.json({ data }, { status: 200 });
}

export function created(data: unknown) {
  return NextResponse.json({ data }, { status: 201 });
}

export function listed(data: unknown[], meta: { page: number; pageSize: number; total: number; totalPages: number }) {
  return NextResponse.json({ data, meta }, { status: 200 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: details ?? {},
      },
    },
    { status },
  );
}
