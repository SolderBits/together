import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperienceLauncher } from "@/components/experiences/experience-launcher";
import { EXPERIENCES, getExperience } from "@/lib/experiences";

export function generateStaticParams() {
  return EXPERIENCES.filter((e) => !e.href).map((e) => ({ experience: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ experience: string }>;
}): Promise<Metadata> {
  const { experience: id } = await params;
  const experience = getExperience(id);
  if (!experience) return { title: "Not found" };
  return { title: experience.title, description: experience.blurb };
}

export default async function PlayPage({
  params,
}: {
  params: Promise<{ experience: string }>;
}) {
  const { experience: id } = await params;
  const experience = getExperience(id);
  if (!experience) notFound();
  return <ExperienceLauncher experienceId={experience.id} />;
}
