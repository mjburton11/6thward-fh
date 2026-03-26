import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken, extractToken, getCorsHeaders } from '../shared/auth';

const PDF_BUCKET_NAME = process.env.PDF_BUCKET_NAME || '6thward-fh-pdfs';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'https://6thward-fh.theburtonforge.com';

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

    bb.on('file', (name: string, file: NodeJS.ReadableStream, info: busboy.FileInfo) => {
      const { filename, mimeType } = info;
      console.log(`File detected: ${filename}, type: ${mimeType}`);

      file.on('data', (data: Buffer) => {
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

    bb.on('error', (error: Error) => {
      reject(error);
    });

    // Write the body to busboy
    // API Gateway sends binary data as base64-encoded
    const body = event.isBase64Encoded 
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'binary');
    
    bb.write(body);
    bb.end();
  });
}

/**
 * Lambda handler for PDF upload
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Upload request received');
  console.log('Headers:', JSON.stringify(event.headers, null, 2));

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

    if (!token) {
      console.log('No token provided');
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Unauthorized</div>',
      };
    }

    const payload = await verifyToken(token);
    
    if (!payload) {
      console.log('Invalid token');
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Unauthorized</div>',
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

    // Generate public URL - PDFs are served from S3 directly (public bucket)
    const publicUrl = `https://${PDF_BUCKET_NAME}.s3.amazonaws.com/${uniqueFilename}`;

    // Return HTML fragment for htmx to insert
    const htmlFragment = `
      <div class="pdf-item" id="pdf-${uniqueFilename}">
        <a href="${publicUrl}" target="_blank" class="pdf-link">
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
