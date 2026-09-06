import type { Metadata } from "next";
import { HonestCards } from "@/components/experiences/honest-cards";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("honest-cards")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function HonestCardsPage() {
  return <HonestCards />;
}
