export type Intent = 0 | 1;
export type Sentiment = "positive" | "neutral" | "negative";
export type ReportStatus = "ready" | "running" | "draft";

export interface Agent {
  id: string;
  workosUserId: string;
  fullName: string;
  email: string;
  phone: string;
  plan: "Premium Agent" | "Starter Agent";
  avatarInitials: string;
  ingestionAddress: string;
}

export interface Lead {
  id: string;
  agentId: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  propertyInterest: string;
  budget: string;
  emailOpens: number;
  linkClicks: number;
  reportViews: number;
  inquirySentiment: number;
  sentiment: Sentiment;
  score: number;
  intent: Intent;
  tier: "Hot" | "Warm" | "Cold";
  createdAt: string;
}

export interface LeadEvent {
  id: string;
  leadId: string;
  agentId: string;
  eventType: "email_open" | "link_click" | "report_view" | "manual_note";
  eventLabel: string;
  occurredAt: string;
}

export interface PropertyReport {
  id: string;
  agentId: string;
  title: string;
  address: string;
  propertyType: string;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  status: ReportStatus;
  marketSignal: string;
  sentimentSummary: string;
  generatedAt: string;
}

export interface Integration {
  id: string;
  agentId: string;
  name: string;
  description: string;
  status: "connected" | "available";
}

export interface SupportRequest {
  id: string;
  agentId: string;
  name: string;
  category: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface DashboardData {
  agent: Agent;
  totals: {
    leadsScored: number;
    averageIntentScore: number;
    reportsGenerated: number;
    highIntentLeads: number;
  };
  highIntentLeads: Lead[];
  recentReports: PropertyReport[];
}

export interface PropertyReportInput {
  address: string;
  propertyType: string;
  sqft: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
}
