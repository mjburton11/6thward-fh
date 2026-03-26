import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { verifyToken, extractToken, getCorsHeaders } from '../shared/auth';

const PDF_BUCKET_NAME = process.env.PDF_BUCKET_NAME || '6thward-fh-pdfs';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'https://6thward-fh.theburtonforge.com';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * Lambda handler for PDF deletion
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Delete request received');
  console.log('Path parameters:', JSON.stringify(event.pathParameters, null, 2));

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
  if (event.httpMethod !== 'DELETE') {
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

    // Get filename from path parameters
    const filename = event.pathParameters?.filename;
    
    if (!filename) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Filename is required</div>',
      };
    }

    console.log(`Deleting file: ${filename}`);

    // Delete from S3
    const deleteCommand = new DeleteObjectCommand({
      Bucket: PDF_BUCKET_NAME,
      Key: filename,
    });

    await s3Client.send(deleteCommand);
    console.log(`File deleted successfully: ${filename}`);

    // Return empty response (htmx will remove the element)
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: '',
    };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: '<div class="error">Delete failed. Please try again.</div>',
    };
  }
}
