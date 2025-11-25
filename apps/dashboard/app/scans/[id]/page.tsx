import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ScanDetails } from "@/components/scans/scan-details";
import type { ScanResponse } from "@/lib/types";

interface ScanDetailsPageProps {
  params: Promise<{ id: string }>;
}

async function getScan(id: string, token: string | null): Promise<ScanResponse> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const response = await fetch(`${API_URL}/v1/scans/${id}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch scan: ${response.statusText}`);
  }

  return response.json();
}

export default async function ScanDetailsPage({ params }: ScanDetailsPageProps) {
  const { userId } = await auth();

  if (!userId) {
    notFound();
  }

  const { id } = await params;

  // TODO: Get Clerk token for server-side requests
  // For now, we'll use client-side fetching in the component
  return <ScanDetails scanId={id} />;
}

