import type { Metadata } from "next";
import { BrandProfileManager } from "@/components/team-portal/BrandProfileManager";

export const metadata: Metadata = { title: "Brand Profiles" };

export default function BrandProfilesPage() {
  return <BrandProfileManager />;
}
