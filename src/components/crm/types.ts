export interface CrmLead {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  cleanPhone: string;
  alternatePhone?: string | null;
  whatsappNumber?: string | null;
  email?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  studentClass?: string | null;
  board?: string | null;
  medium?: string | null;
  targetExam?: string | null;
  targetYear?: number | null;
  preferredSubject?: string | null;
  preferredCourse?: string | null;
  targetCourseId?: string | null;
  targetBatchId?: string | null;
  state?: string | null;
  city?: string | null;
  school?: string | null;
  expectedBudget?: number | null;
  status: string;
  priority: "HOT" | "WARM" | "COLD";
  score: number;
  source: string;
  campaignId?: string | null;
  campaignName?: string | null;
  assignedUserId?: string | null;
  assignedUser?: { id: string; name: string; email?: string } | null;
  campaign?: { id: string; name: string; platform: string } | null;
  targetCourse?: { id: string; title: string } | null;
  targetBatch?: { id: string; name: string; code: string } | null;
  isConverted: boolean;
  studentId?: string | null;
  student?: { id: string; enrollmentNumber: string } | null;
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  followUps?: Array<{ id: string; scheduledAt: string; title: string; type: string; priority: string }>;
  _count?: {
    activities: number;
    followUps: number;
    callRecords: number;
    counsellingSessions: number;
  };
}

export interface CrmDashboardMetrics {
  kpis: {
    totalLeads: number;
    newToday: number;
    thisWeek: number;
    unassigned: number;
    hotLeads: number;
    contacted: number;
    counsellingScheduled: number;
    enrolled: number;
    lostLeads: number;
    followUpsDueToday: number;
    overdueFollowUps: number;
    conversionRate: string;
  };
  funnel: Array<{ stage: string; count: number }>;
  statusCounts: Array<{ status: string; count: number }>;
  sourceCounts: Array<{ source: string; count: number }>;
  counselorPerformance: Array<{
    id: string;
    name: string;
    assignedLeads: number;
    callsMade: number;
    counsellingCompleted: number;
  }>;
  campaigns: Array<{
    id: string;
    name: string;
    platform: string;
    spend: number;
    leads: number;
    cpl: number;
  }>;
}

export interface CounsellorOption {
  id: string;
  name: string;
  role: string;
}

export interface CourseOption {
  id: string;
  title: string;
  slug: string;
}

export interface BatchOption {
  id: string;
  name: string;
  code: string;
  courseId?: string | null;
  status: string;
}
