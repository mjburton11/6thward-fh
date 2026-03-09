export interface PDFMetadata {
  filename: string;
  size: number;
  lastModified: Date;
  url: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  message: string;
}

export interface APIResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
