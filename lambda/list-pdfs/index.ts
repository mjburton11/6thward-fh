import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { verifyToken, extractToken, getCorsHeaders } from '../shared/auth';
import { PDFMetadata } from '../shared/types';

const PDF_BUCKET_NAME = process.env.PDF_BUCKET_NAME || '';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Format file size to human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format date to relative time
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

/**
 * Lambda handler for listing PDFs
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('List PDFs request received');

  const corsHeaders = getCorsHeaders(ALLOWED_ORIGINS);

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Validate HTTP method
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: '<div class="error">Method not allowed</div>',
    };
  }

  try {
    // Verify JWT token
    const authHeader = event.headers.Authorization || event.headers.authorization;
    const token = extractToken(authHeader);

    if (!token || !verifyToken(token)) {
      console.log('Invalid or missing token');
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Unauthorized</div>',
      };
    }

    // Validate bucket configuration
    if (!PDF_BUCKET_NAME) {
      console.error('PDF_BUCKET_NAME environment variable not set');
      return {
        statusCode: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Server configuration error</div>',
      };
    }

    // List objects in S3 bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: PDF_BUCKET_NAME,
    });

    const response = await s3Client.send(listCommand);
    console.log(`Found ${response.Contents?.length || 0} PDFs`);

    // Transform S3 objects to PDFMetadata
    const pdfs: PDFMetadata[] = (response.Contents || [])
      .filter(obj => obj.Key && obj.Key.endsWith('.pdf'))
      .map(obj => ({
        filename: obj.Key!,
        size: obj.Size || 0,
        lastModified: obj.LastModified || new Date(),
        url: CLOUDFRONT_DOMAIN 
          ? `https://${CLOUDFRONT_DOMAIN}/${obj.Key}`
          : `https://${PDF_BUCKET_NAME}.s3.amazonaws.com/${obj.Key}`,
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime()); // Sort by newest first

    // Generate HTML fragment
    if (pdfs.length === 0) {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="empty-state">No PDFs uploaded yet. Upload your first PDF above!</div>',
      };
    }

    const htmlFragments = pdfs.map(pdf => `
      <div class="pdf-item">
        <a href="/${pdf.filename}" target="_blank" class="pdf-link">
          <span class="pdf-icon">📄</span>
          <span class="pdf-name">${pdf.filename}</span>
        </a>
        <span class="pdf-size">${formatFileSize(pdf.size)}</span>
        <span class="pdf-date">${formatDate(pdf.lastModified)}</span>
      </div>
    `).join('');

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: htmlFragments,
    };
  } catch (error) {
    console.error('List PDFs error:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: '<div class="error">Failed to load PDFs. Please try again.</div>',
    };
  }
}
