// ─────────────────────────────────────────
// Softworks Brief Assistant — Shared Types
// ─────────────────────────────────────────

export type BriefStatus =
  | 'pending_ai'
  | 'ai_processed'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent_to_dept';

export type AssetType = 'image' | 'audio' | 'document';

export type Department =
  | 'design'
  | 'development'
  | 'marketing'
  | 'content'
  | 'hr'
  | 'finance'
  | 'operations'
  | 'other';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface StructuredBrief {
  project_title: string;
  goals: string[];
  ambiguities: string[];
  department: Department;
  priority: Priority;
  deadline?: string; // ISO date string
  summary: string;
  target_audience?: string;
  deliverables?: string[];
  budget_range?: string;
  references?: string[];
}

export interface Brief {
  id: string;
  created_at: string;
  updated_at: string;
  submitter_name: string;
  submitter_email: string;
  submitter_phone?: string;
  raw_text?: string;
  structured_brief?: StructuredBrief;
  project_title?: string;
  goals?: string[];
  ambiguities?: string[];
  department?: Department;
  priority: Priority;
  deadline?: string;
  status: BriefStatus;
  manager_notes?: string;
  approved_by?: string;
  approved_at?: string;
  share_token?: string;
  share_token_expires_at?: string;
  pdf_path?: string;
}

export interface BriefAsset {
  id: string;
  created_at: string;
  brief_id: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  storage_path: string;
  asset_type: AssetType;
}

export interface EmailLog {
  id: string;
  created_at: string;
  brief_id?: string;
  recipient: string;
  subject: string;
  type: 'manager_notification' | 'submitter_confirmation' | 'dept_routing';
  resend_id?: string;
  status: string;
}

// API request/response types
export interface SubmitBriefRequest {
  submitter_name: string;
  submitter_email: string;
  submitter_phone?: string;
  raw_text?: string;
}

export interface ApproveRequest {
  action: 'approve' | 'reject';
  manager_notes?: string;
  approved_by: string;
}

export interface UploadResponse {
  asset_id: string;
  storage_path: string;
  public_url?: string;
}
