import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken, extractToken, getCorsHeaders } from '../shared/auth';

const PDF_BUCKET_NAME = process.env.PDF_BUCKET_NAME || '';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

interface FileUpload {
  filename: string;
  data: Buffer;
  mimeType: string;
}

/**
 * Parse multipart form data
 */
function parseMultipartForm(event: APIGatewayProxyEvent): Promise<FileUpload> {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    const bb = busboy({ headers: { 'content-type': contentType } });
    
    let fileUpload: FileUpload | null = null;
    const chunks: Buffer[] = [];

    bb.on('file', (name, file, info) => {
      const { filename, mimeType } = info;
      console.log(`File detected: ${filename}, type: ${mimeType}`);

      file.on('data', (data) => {
        chunks.push(data);
      });

      file.on('end', () => {
        fileUpload = {
          filename,
          data: Buffer.concat(chunks),
          mimeType,
        };
      });
    });

    bb.on('finish', () => {
      if (fileUpload) {
        resolve(fileUpload);
      } else {
        reject(new Error('No file uploaded'));
      }
    });

    bb.on('error', (error) => {
      reject(error);
    });

    // Write the body to busboy
    const body = event.isBase64Encoded 
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'utf-8');
    
    bb.write(body);
    bb.end();
  });
}

/**
 * Lambda handler for PDF upload
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Upload request received');

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
  if (event.httpMethod !== 'POST') {
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

    // Parse multipart form data
    const fileUpload = await parseMultipartForm(event);
    console.log(`Parsed file: ${fileUpload.filename}, size: ${fileUpload.data.length} bytes`);

    // Validate file is PDF
    if (!fileUpload.mimeType.includes('pdf') && !fileUpload.filename.toLowerCase().endsWith('.pdf')) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Only PDF files are allowed</div>',
      };
    }

    // Generate unique filename
    const fileExtension = '.pdf';
    const sanitizedFilename = fileUpload.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFilename = `${uuidv4()}-${sanitizedFilename}`;

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: PDF_BUCKET_NAME,
      Key: uniqueFilename,
      Body: fileUpload.data,
      ContentType: 'application/pdf',
      CacheControl: 'public, max-age=31536000',
    });

    await s3Client.send(uploadCommand);
    console.log(`File uploaded successfully: ${uniqueFilename}`);

    // Generate public URL
    const publicUrl = CLOUDFRONT_DOMAIN 
      ? `https://${CLOUDFRONT_DOMAIN}/${uniqueFilename}`
      : `https://${PDF_BUCKET_NAME}.s3.amazonaws.com/${uniqueFilename}`;

    // Return HTML fragment for htmx to insert
    const htmlFragment = `
      <div class="pdf-item" id="pdf-${uniqueFilename}">
        <a href="/${uniqueFilename}" target="_blank" class="pdf-link">
          <span class="pdf-icon">📄</span>
          <span class="pdf-name">${sanitizedFilename}</span>
        </a>
        <span class="pdf-size">${(fileUpload.data.length / 1024).toFixed(2)} KB</span>
        <span class="pdf-date">Just now</span>
      </div>
    `;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: htmlFragment,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: '<div class="error">Upload failed. Please try again.</div>',
    };
  }
}
