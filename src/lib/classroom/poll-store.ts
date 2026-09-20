import "server-only";

export type ClassroomPollOption = {
  key: string;
  label: string;
};

export type ClassroomPollState = {
  id: string;
  classroomSessionId: string;
  questionText: string;
  options: ClassroomPollOption[];
  correctOption?: string;
  timeLimitSec: number;
  status: "ACTIVE" | "REVEALED" | "ENDED";
  startedAt: string;
  votes: Record<string, string>; // userId -> option key
  counts: Record<string, number>;
  totalVotes: number;
};

type GlobalPollStore = {
  polls: Map<string, ClassroomPollState>; // classroomSessionId -> active/latest poll
};

const globalForPolls = globalThis as unknown as {
  __classroomPollStore?: GlobalPollStore;
};

if (!globalForPolls.__classroomPollStore) {
  globalForPolls.__classroomPollStore = {
    polls: new Map<string, ClassroomPollState>(),
  };
}

const store = globalForPolls.__classroomPollStore;

export function getPollForSession(classroomSessionId: string): ClassroomPollState | null {
  const poll = store.polls.get(classroomSessionId);
  if (!poll) return null;
  return poll;
}

export function createPollForSession({
  classroomSessionId,
  questionText,
  options,
  correctOption,
  timeLimitSec = 30,
}: {
  classroomSessionId: string;
  questionText: string;
  options: ClassroomPollOption[];
  correctOption?: string;
  timeLimitSec?: number;
}): ClassroomPollState {
  const initialCounts: Record<string, number> = {};
  for (const opt of options) {
    initialCounts[opt.key] = 0;
  }

  const poll: ClassroomPollState = {
    id: `poll-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    classroomSessionId,
    questionText: questionText.trim() || "Live Class Poll",
    options,
    correctOption: correctOption || undefined,
    timeLimitSec: Math.max(10, Math.min(180, timeLimitSec)),
    status: "ACTIVE",
    startedAt: new Date().toISOString(),
    votes: {},
    counts: initialCounts,
    totalVotes: 0,
  };

  store.polls.set(classroomSessionId, poll);
  return poll;
}

export function recordPollVote({
  classroomSessionId,
  pollId,
  userId,
  selectedOption,
}: {
  classroomSessionId: string;
  pollId: string;
  userId: string;
  selectedOption: string;
}): { poll: ClassroomPollState; isNewVote: boolean } | null {
  const poll = store.polls.get(classroomSessionId);
  if (!poll || poll.id !== pollId) return null;
  if (poll.status !== "ACTIVE") return null;

  // Verify option exists
  if (!poll.options.some((o) => o.key === selectedOption)) return null;

  // Prevent duplicate vote
  if (poll.votes[userId]) {
    return { poll, isNewVote: false };
  }

  poll.votes[userId] = selectedOption;
  poll.counts[selectedOption] = (poll.counts[selectedOption] || 0) + 1;
  poll.totalVotes += 1;

  return { poll, isNewVote: true };
}

export function revealPollForSession({
  classroomSessionId,
  pollId,
  correctOption,
}: {
  classroomSessionId: string;
  pollId: string;
  correctOption?: string;
}): ClassroomPollState | null {
  const poll = store.polls.get(classroomSessionId);
  if (!poll || poll.id !== pollId) return null;

  poll.status = "REVEALED";
  if (correctOption) {
    poll.correctOption = correctOption;
  }

  return poll;
}

export function endPollForSession({
  classroomSessionId,
  pollId,
}: {
  classroomSessionId: string;
  pollId: string;
}): ClassroomPollState | null {
  const poll = store.polls.get(classroomSessionId);
  if (!poll || poll.id !== pollId) return null;

  poll.status = "ENDED";
  return poll;
}
