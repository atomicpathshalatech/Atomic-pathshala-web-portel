"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export function BatchNotificationManager({
  batchId,
  batchName,
  canSend,
}: {
  batchId: string;
  batchName: string;
  canSend: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [eligibleCount, setEligibleCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("SYSTEM");
  const [priority, setPriority] = useState("NORMAL");
  const [actionType, setActionType] = useState("VIEW_DETAILS");
  const [actionUrl, setActionUrl] = useState("");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/team/batches/${batchId}/notifications`);
      const data = await res.json();
      if (data.success) {
        setEligibleCount(data.eligibleCount || 0);
        setNotifications(data.notifications || []);
      }
    } catch {
      toast.error("Failed to load batch notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batchId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    let scheduledFor: string | undefined;
    if (sendMode === "schedule") {
      if (!scheduleDate || !scheduleTime) {
        toast.error("Please select scheduled date and time");
        return;
      }
      scheduledFor = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/team/batches/${batchId}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          category,
          priority,
          actionType: actionType || undefined,
          actionUrl: actionUrl.trim() || undefined,
          scheduledFor,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create notification");
      }

      toast.success(
        json.scheduled
          ? "Notification scheduled successfully"
          : `Dispatched to ${json.dispatchedCount} active students`
      );

      setIsModalOpen(false);
      setTitle("");
      setMessage("");
      setActionUrl("");
      setSendMode("now");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner / Summary */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">campaign</span>
            Batch Notifications
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Targeted announcements, material alerts and reminders sent exclusively to students of{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{batchName}</span>.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-sm">group</span>
              Recipients: {eligibleCount} Students
            </span>
          </div>
        </div>

        {canSend && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary/90 active:scale-95 transition-all flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-base">add_comment</span>
            Create Notification
          </button>
        )}
      </div>

      {/* History List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Recent Batch Notifications ({notifications.length})
          </h3>
          <button
            onClick={loadData}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">
              notifications_off
            </span>
            <p className="text-xs text-slate-500 font-medium">
              No manual notifications sent to this batch yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {notifications.map((n) => (
              <div key={n.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {n.category}
                      </span>
                      {n.priority === "URGENT" && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-red-500 text-white">
                          URGENT
                        </span>
                      )}
                      {n.priority === "HIGH" && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500 text-black">
                          HIGH
                        </span>
                      )}
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {n.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
                      {n.body}
                    </p>
                    {n.actionUrl && (
                      <span className="inline-block text-[11px] text-primary font-mono mt-1">
                        Link: {n.actionUrl}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                    {new Date(n.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  New Batch Notification
                </h3>
                <p className="text-xs text-primary font-semibold mt-0.5">
                  Target: {batchName} ({eligibleCount} Students)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Special Doubt Clearing Session"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message *
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the notification message here…"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs focus:outline-none"
                  >
                    <option value="CLASSES">Classes</option>
                    <option value="TESTS">Tests</option>
                    <option value="STUDY_MATERIAL">Study Material</option>
                    <option value="OFFERS">Offers</option>
                    <option value="MOTIVATION">Motivation</option>
                    <option value="SYSTEM">System Announcement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent (Red Alert)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Action Button
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs focus:outline-none"
                  >
                    <option value="VIEW_DETAILS">View Details</option>
                    <option value="JOIN_CLASS">Join Class</option>
                    <option value="START_TEST">Start Test</option>
                    <option value="OPEN_PDF">View PDF</option>
                    <option value="OPEN_DPP">View DPP</option>
                    <option value="VIEW_OFFER">View Offer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Action URL (optional)
                  </label>
                  <input
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder={`/batches/${batchId}`}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Delivery Timing
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="sendMode"
                      checked={sendMode === "now"}
                      onChange={() => setSendMode("now")}
                      className="text-primary"
                    />
                    Send Immediately
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="sendMode"
                      checked={sendMode === "schedule"}
                      onChange={() => setSendMode("schedule")}
                      className="text-primary"
                    />
                    Schedule for Future
                  </label>
                </div>

                {sendMode === "schedule" && (
                  <div className="grid grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Date</label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1">Time</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? "Sending…" : sendMode === "schedule" ? "Schedule" : "Send Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
