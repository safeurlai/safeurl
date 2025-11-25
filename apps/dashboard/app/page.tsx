import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export default async function HomePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <DashboardHome />;
}

