import type { Metadata } from "next";
import { ExperienceLauncher } from "@/components/experiences/experience-launcher";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("photobooth")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function PhotoboothPage() {
  return <ExperienceLauncher experienceId="photobooth" />;
}
