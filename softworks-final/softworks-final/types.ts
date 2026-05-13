export interface Brief {
  id: string;
  project_title?: string;
  status: string;
  priority: string;

  submitter_name: string;
  submitter_email: string;

  created_at: string;
  deadline?: string;

  department?: string;

  goals?: string[];
  ambiguities?: string[];

  manager_notes?: string;
  approved_at?: string;
  approved_by?: string;

  structured_brief?: {
    summary?: string;
    goals?: string[];
    deliverables?: string[];
    target_audience?: string;
    ambiguities?: string[];
  };

  share_token?: string;
  share_token_expires_at?: string;
}
export interface BriefAsset {
  id: string;
  file_name: string;
  file_size?: number;
  asset_type: string;
  signed_url?: string;
}
