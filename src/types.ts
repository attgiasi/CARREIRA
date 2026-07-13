export type JsonRecord = Record<string, unknown>;

export interface AgentSettings {
  agent: {
    enabled: boolean;
    paused: boolean;
    dryRun: boolean;
    timezone: string;
    runEveryHours: number;
    maxJobsPerRun: number;
    dashboardPort: number;
  };
  ai: {
    provider: string;
    openai?: { enabled?: boolean; model?: string };
    gemini?: { enabled?: boolean; model?: string };
  };
  profile: {
    name: string;
    city: string;
    state: string;
    country: string;
    email: string;
    phone: string;
    linkedin: string;
    maritalStatus?: string;
    summary: string;
    education: { highestLevel: string; degrees: string[] };
    driverLicense: { hasLicense: boolean; categories: string[]; hasOwnVehicle: boolean };
  };
  careerTracks: JsonRecord;
  jobSearchPreferences: JsonRecord;
  salaryPreferences: JsonRecord;
  informalWork: JsonRecord;
  sources: JsonRecord;
  strategy: {
    mode: string;
    maxApplicationsPerDay: number;
    onlyPrepareAboveScore: number;
    onlyApplyAboveScore: number;
  } & JsonRecord;
  applications: JsonRecord;
  platformRules: JsonRecord;
  safety: JsonRecord;
  badJobDetection: {
    blockedTerms: string[];
    flagTerms: string[];
    blockedCompanies: string[];
    blockedPlatforms: string[];
  };
}

export interface RawJob {
  externalId?: string;
  title: string;
  company?: string;
  location?: string;
  source: string;
  url?: string;
  description?: string;
  salary?: string;
  raw?: JsonRecord;
}

export interface NormalizedJob {
  externalId: string;
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  description: string;
  salary: string;
  workModel: string;
  travelRequired: boolean;
  driverLicenseRequired: boolean;
  driverLicenseCategories: string[];
  ownVehicleRequired: boolean;
  educationRequired: string;
  educationLevelDetected: string;
  seniorityLevel: string;
  careerTrack: string;
  employmentType: string;
  scheduleType: string;
  fitScore: number;
  hireChanceScore: number;
  jobQualityScore: number;
  riskScore: number;
  fitReason: string;
  hireChanceReason: string;
  riskFlags: string[];
  status: string;
  raw: JsonRecord;
}

export interface InformalOpportunity {
  type: string;
  title: string;
  contractorName: string;
  company: string;
  eventType: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  estimatedHours: number;
  totalPay: number;
  hourlyRate: number;
  paymentMethod: string;
  paymentDelayDays: number;
  foodIncluded: boolean;
  transportIncluded: boolean;
  requiresOwnTools: boolean;
  requiresUniform: boolean;
  requiresDriverLicense: boolean;
  requiresOwnVehicle: boolean;
  description: string;
  source: string;
  url: string;
  freelaScore: number;
  riskScore: number;
  riskFlags: string[];
  status: string;
  raw: JsonRecord;
}

export interface ApplicationPacket {
  jobId: number;
  cvVersion: string;
  generatedResumePath: string;
  coverLetterPath: string;
  approvalStatus: string;
  notes: string;
}
