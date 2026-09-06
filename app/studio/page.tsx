import type { Metadata } from "next";
import { PrintStudio } from "@/components/experiences/print-studio";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("print-studio")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function StudioPage() {
  return <PrintStudio />;
}
