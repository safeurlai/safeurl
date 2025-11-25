import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Server-side API proxy route
 * Forwards requests to the backend API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, params, "POST");
}

async function handleRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  try {
    console.log(`[API Proxy] ===== REQUEST START =====`);
    console.log(`[API Proxy] Method: ${method}`);
    console.log(`[API Proxy] Request URL: ${request.url}`);

    const { path } = await params;
    const apiPath = `/${path.join("/")}`;
    const url = `${API_URL}${apiPath}`;

    console.log(`[API Proxy] Forwarding to: ${url}`);
    console.log(`[API Proxy] API path: ${apiPath}`);

    const body = method === "POST" ? await request.text() : undefined;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    console.log(`[API Proxy] Request headers:`, Object.keys(headers));
    console.log(`[API Proxy] Sending request to backend...`);

    const response = await fetch(url, {
      method,
      headers,
      body,
    });

    console.log(`[API Proxy] Backend response status: ${response.status}`);
    console.log(
      `[API Proxy] Backend response headers:`,
      Object.fromEntries(response.headers.entries())
    );

    const data = await response.json();

    console.log(
      `[API Proxy] Backend response data:`,
      JSON.stringify(data, null, 2)
    );
    console.log(`[API Proxy] ===== REQUEST END =====`);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[API Proxy] Error:", error);
    return NextResponse.json(
      { error: { code: "network_error", message: "Failed to connect to API" } },
      { status: 500 }
    );
  }
}
