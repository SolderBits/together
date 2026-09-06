import type { Metadata } from "next";
import { Letters } from "@/components/experiences/letters";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("letters")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function LettersPage() {
  return <Letters />;
}
