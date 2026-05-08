import { proxyToDjango } from "@/lib/server/django";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ path: string[] }>;
};

function djangoPath(parts: string[]) {
  return `/api/${parts.join("/")}/`;
}

export async function GET(request: Request, { params }: Params) {
  return proxyToDjango({ request, path: djangoPath((await params).path) });
}

export async function POST(request: Request, { params }: Params) {
  return proxyToDjango({ request, path: djangoPath((await params).path) });
}

export async function PATCH(request: Request, { params }: Params) {
  return proxyToDjango({ request, path: djangoPath((await params).path) });
}

export async function DELETE(request: Request, { params }: Params) {
  return proxyToDjango({ request, path: djangoPath((await params).path) });
}
