/**
 * ATOMIC PATHSHALA — CENTRAL GEMINI AI GATEWAY TYPES
 * Universal definitions for workloads, priorities, model tiers, and telemetry.
 */

export type AIWorkloadRole =
  | "STUDENT_PRACTICE"       // Student Question Practice & Quizzes (High Priority)
  | "AI_TUTOR"               // Real-time Doubt Solving & Chat (High Priority)
  | "TEST_PORTAL"            // Question Creation, Editing, Validation (Medium Priority)
  | "DOCUMENT_PROCESSING"   // PDF Extraction, OCR, Syllabus Mapping (Background Priority)
  | "CRM_ANALYSIS"           // Lead Scoring, Sales Assistance (Low Priority)
  | "BACKUP_FAILOVER";       // Emergency reserve capacity

export type AIRequestPriority = 1 | 2 | 3 | 4; // 1 = Highest (Student), 4 = Lowest (Bulk PDF)

export type ModelComplexityTier = "LOW_COST" | "BALANCED" | "HIGH_COMPLEXITY";

export interface AIModelConfig {
  id: string;
  displayName: string;
  tier: ModelComplexityTier;
  contextWindowTokens: number;
  maxOutputTokens: number;
  inputPricePerMillionUsd: number;
  outputPricePerMillionUsd: number;
  supportsThinking: boolean;
  enabled: boolean;
}

export interface AIProjectCredential {
  id: string;
  name: string;
  projectNumber?: string;
  assignedRole: AIWorkloadRole;
  maskedKey: string;
  rawKey: string;
  billingType: "FREE" | "PAID_PREPAY" | "PAID_POSTPAY";
  enabled: boolean;
  isHealthy: boolean;
  lastHealthCheckAt?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  failureReason?: string;
  cooldownUntil?: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rpmQuotaLimit: number;
  activeInFlightRequests: number;
}

export interface AICostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  costInr: number;
  costPaise: number;
}

export interface AIGatewayRequestOptions {
  workload: AIWorkloadRole;
  priority?: AIRequestPriority;
  complexity?: ModelComplexityTier;
  preferredModel?: string;
  requestId?: string; // Idempotency key
  userId?: string;
  maxTokens?: number;
  temperature?: number;
  cacheTtlMs?: number; // 0 to disable caching
  timeoutMs?: number;
}

export interface AIGatewayResponse<T = string> {
  data: T;
  rawText: string;
  modelUsed: string;
  projectUsed: string;
  keyMasked: string;
  durationMs: number;
  cost: AICostEstimate;
  cached: boolean;
  requestId: string;
}

export interface AIProviderTelemetry {
  timestamp: number;
  workload: AIWorkloadRole;
  model: string;
  project: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costInr: number;
  ok: boolean;
  errorCode?: string;
}
