import { ScanDetails } from "~/components/scans/scan-details";

interface ScanDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ScanDetailsPage({
  params,
}: ScanDetailsPageProps) {
  const { id } = await params;
  return <ScanDetails scanId={id} />;
}
