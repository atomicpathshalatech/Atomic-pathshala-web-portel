"use client";

import { useEffect, useState } from "react";
import type { PresenceChannel } from "pusher-js";
import { getPusherClient } from "@/lib/realtime/pusher-client";
import { classroomChannel } from "@/lib/realtime/events";

/** Live student count via the presence channel's member list — same two-tier pattern as Whiteboard's ParticipantsPanel (instant/ephemeral badge; ClassroomAttendance rows are the durable analytics source). */
export function StudentCountBadge({ classroomSessionId }: { classroomSessionId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const client = getPusherClient();
    const channel = client.subscribe(classroomChannel(classroomSessionId)) as PresenceChannel;

    const updateCount = () => {
      const members = channel.members;
      // Exclude teacher(s) from "students present" — members.each gives {id, info}. info.role was set at auth time (see pusher/auth's resolveClassroomAccess call).
      let studentCount = 0;
      members.each((member: { id: string; info?: { role?: string } }) => {
        if (member.info?.role !== "TEACHER") studentCount++;
      });
      setCount(studentCount);
    };

    channel.bind("pusher:subscription_succeeded", updateCount);
    channel.bind("pusher:member_added", updateCount);
    channel.bind("pusher:member_removed", updateCount);

    return () => {
      channel.unbind("pusher:subscription_succeeded", updateCount);
      channel.unbind("pusher:member_added", updateCount);
      channel.unbind("pusher:member_removed", updateCount);
      client.unsubscribe(classroomChannel(classroomSessionId));
    };
  }, [classroomSessionId]);

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1f2b] border border-[#2d2e3b] text-gray-200 text-xs font-semibold">
      <span className="material-symbols-outlined text-sm">groups</span>
      {count}
    </div>
  );
}
