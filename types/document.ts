export interface DocumentItem {
  id: string;
  document_id?: string;
  filename: string;
  created_at?: string;
  upload_date?: string;
  size_bytes?: number;
  size?: number | string;
  page_count?: number;
  status?: string;
  [key: string]: unknown;
}

export interface DocumentUploadResponse {
  uploaded?: DocumentItem[];
  documents?: DocumentItem[];
  message?: string;
  status?: string;
  [key: string]: unknown;
}
