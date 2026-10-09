/**
 * Don't make a person wait on one slow attempt.
 *
 * An AI model that is "experiencing high demand" often takes 7–18 seconds to
 * say so, and one attempt can hang for a minute. Tried one after another,
 * those waits add up — extracting a single question took 30–60 s although a
 * healthy call answers in 4–11 s. So: start the first attempt; if it has not
 * answered after `hedgeAfterMs`, start a second one alongside it (the caller
 * gives each lane a different model order), then a third. The first answer
 * wins; a lane that fails starts the next one at once. Extra attempts are
 * only made when the first one is slow.
 */
export function hedge<T>(
  run: (lane: number) => Promise<T>,
  opts: { lanes?: number; hedgeAfterMs?: number } = {}
): Promise<T> {
  const lanes = Math.max(1, opts.lanes ?? 3);
  const hedgeAfterMs = opts.hedgeAfterMs ?? 7000;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let started = 0;
    let running = 0;
    let firstError: unknown = null;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      fn();
    };
    const launch = () => {
      if (settled || started >= lanes) return;
      const lane = started++;
      running++;
      let attempt: Promise<T>;
      try {
        attempt = run(lane);
      } catch (err) {
        attempt = Promise.reject(err);
      }
      attempt.then(
        (value) => finish(() => resolve(value)),
        (err) => {
          running--;
          firstError ??= err;
          if (settled) return;
          if (started < lanes) launch();
          else if (running === 0) finish(() => reject(firstError));
        }
      );
    };
    launch();
    for (let i = 1; i < lanes; i++) timers.push(setTimeout(launch, hedgeAfterMs * i));
  });
}

/** `list` starting from index `by` (wrapping round). */
export function rotated<T>(list: readonly T[], by: number): T[] {
  if (!list.length) return [];
  const n = ((by % list.length) + list.length) % list.length;
  return [...list.slice(n), ...list.slice(0, n)];
}
