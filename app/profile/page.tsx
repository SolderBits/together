import type { Metadata } from "next";
import { Profile } from "@/components/experiences/profile";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your display name, badge and saved data.",
};

export default function ProfilePage() {
  return <Profile />;
}
