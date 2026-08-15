import { handleV1Request } from "@/src/server/api/v1/routes";

type ParamsContext = {
  params: Promise<{
    segments: string[];
  }>;
};

async function run(
  request: Request,
  context: ParamsContext,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
) {
  const params = await context.params;

  return handleV1Request(
    request,
    params.segments ?? [],
    method
  );
}

export async function GET(
  request: Request,
  context: ParamsContext
) {
  return run(request, context, "GET");
}

export async function POST(
  request: Request,
  context: ParamsContext
) {
  return run(request, context, "POST");
}

export async function PATCH(
  request: Request,
  context: ParamsContext
) {
  return run(request, context, "PATCH");
}

export async function PUT(
  request: Request,
  context: ParamsContext
) {
  return run(request, context, "PUT");
}

export async function DELETE(
  request: Request,
  context: ParamsContext
) {
  return run(request, context, "DELETE");
}