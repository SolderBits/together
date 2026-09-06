import type { Metadata } from "next";
import { GiftViewer } from "@/components/experiences/gift-viewer";

export const metadata: Metadata = {
  title: "A gift for you",
  description: "Someone made you a page.",
  robots: { index: false, follow: false },
};

export default async function GiftPage({ params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  return <GiftViewer giftId={giftId} />;
}
