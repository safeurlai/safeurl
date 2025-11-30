import { SignedIn, SignedOut } from "@clerk/nextjs";

import { DashboardHome } from "~/components/dashboard/dashboard-home";
import { LandingPage } from "~/components/landing/landing-page";

export default async function HomePage() {
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <DashboardHome />
      </SignedIn>
    </>
  );
}
