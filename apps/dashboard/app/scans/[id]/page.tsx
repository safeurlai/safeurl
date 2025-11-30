import { ScanDetails } from "~/components/scans/scan-details";

interface ScanPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ScanPage({ params }: ScanPageProps) {
  const { id } = await params;
  return <ScanDetails scanId={id} />;
}
