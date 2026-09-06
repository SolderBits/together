import type { Metadata } from "next";
import { BirthdayGift } from "@/components/experiences/birthday-gift";
import { getExperience } from "@/lib/experiences";

const experience = getExperience("birthday-gift")!;

export const metadata: Metadata = {
  title: experience.title,
  description: experience.blurb,
};

export default function BirthdayGiftPage() {
  return <BirthdayGift />;
}
