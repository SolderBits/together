import type { Metadata } from "next";
import { CouplesHub } from "@/components/experiences/couples-hub";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("couples-hub")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function HubPage() {
  return <CouplesHub />;
}
