/**
 * ATOMIC PATHSHALA — INTELLIGENT CIRCUIT BREAKER & EXPONENTIAL BACKOFF
 * Protects downstream Google API from request storms and manages recovery.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
}

export class AICircuitBreaker {
  private circuits = new Map<string, CircuitMetrics>();
  private failureThreshold = 3;
  private recoveryTimeoutMs = 30_000;

  public canExecute(circuitKey: string): boolean {
    const metrics = this.getMetrics(circuitKey);
    const now = Date.now();

    if (metrics.state === "OPEN") {
      if (now - metrics.lastFailureTime > this.recoveryTimeoutMs) {
        metrics.state = "HALF_OPEN";
        return true;
      }
      return false; // Circuit is open: fail fast without making network call
    }

    return true; // CLOSED or HALF_OPEN can try
  }

  public recordSuccess(circuitKey: string): void {
    const metrics = this.getMetrics(circuitKey);
    metrics.successes++;
    metrics.failures = 0;
    metrics.state = "CLOSED";
  }

  public recordFailure(circuitKey: string, isTerminal: boolean = false): void {
    const metrics = this.getMetrics(circuitKey);
    metrics.failures++;
    metrics.lastFailureTime = Date.now();

    if (isTerminal || metrics.failures >= this.failureThreshold) {
      metrics.state = "OPEN";
    }
  }

  public getState(circuitKey: string): CircuitState {
    return this.getMetrics(circuitKey).state;
  }

  private getMetrics(circuitKey: string): CircuitMetrics {
    let m = this.circuits.get(circuitKey);
    if (!m) {
      m = { failures: 0, successes: 0, lastFailureTime: 0, state: "CLOSED" };
      this.circuits.set(circuitKey, m);
    }
    return m;
  }

  /**
   * Exponential backoff with random jitter.
   */
  public async waitWithJitter(attempt: number, baseDelayMs: number = 600, maxDelayMs: number = 8000): Promise<void> {
    const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
    const jitter = Math.floor(Math.random() * (exp * 0.3));
    const totalMs = exp + jitter;
    await new Promise((r) => setTimeout(r, totalMs));
  }
}

export const aiCircuitBreaker = new AICircuitBreaker();
