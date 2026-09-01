import type { Metadata } from "next";
import { AtomicWhiteboardStudio } from "@/components/whiteboard/AtomicWhiteboardStudio";

export const metadata: Metadata = {
  title: "Live Classroom Whiteboard Studio — Atomic Pathshala",
};

export default function TeamLiveStudioPage() {
  return (
    <AtomicWhiteboardStudio
      initialTitle="NEET Chemistry: Chemical Bonding & Molecular Structure"
      batchName="YODHA NEET 2027"
    />
  );
}
