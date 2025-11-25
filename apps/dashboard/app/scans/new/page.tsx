import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NewScanForm } from "@/components/scans/new-scan-form";

export default async function NewScanPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <NewScanForm />;
}

