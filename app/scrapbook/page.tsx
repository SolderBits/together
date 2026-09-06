import type { Metadata } from "next";
import { Scrapbook } from "@/components/experiences/scrapbook";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("scrapbook")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function ScrapbookPage() {
  return <Scrapbook />;
}
