import type { Metadata } from "next";
import { Arcade } from "@/components/experiences/arcade";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("arcade")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function ArcadePage() {
  return <Arcade />;
}
