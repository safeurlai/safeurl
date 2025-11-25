import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Server-side API proxy route
 * Handles authenticated requests to the backend API
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
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: { code: "authentication_error", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const { path } = await params;
    const apiPath = `/${path.join("/")}`;
    const url = `${API_URL}${apiPath}`;

    // Get Clerk token for backend authentication
    const token = await getClerkToken();

    const body = method === "POST" ? await request.text() : undefined;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Handle auth errors specifically
    if (error instanceof Error && error.message.includes("auth()")) {
      return NextResponse.json(
        { error: { code: "authentication_error", message: "Authentication failed" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: { code: "network_error", message: "Failed to connect to API" } },
      { status: 500 }
    );
  }
}

async function getClerkToken(): Promise<string | null> {
  // In a real implementation, you'd get the token from Clerk
  // For now, we'll need to use Clerk's server-side SDK
  // This is a placeholder - you'll need to implement proper token retrieval
  return null;
}

