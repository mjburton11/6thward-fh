import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as bcrypt from 'bcryptjs';
import { generateToken, getCorsHeaders } from '../shared/auth';
import { getSecrets } from '../shared/secrets';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'https://6thward-fh.theburtonforge.com';

/**
 * Parse form-urlencoded body
 */
function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = body.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  
  return params;
}

/**
 * Lambda handler for authentication
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Auth request received:', JSON.stringify(event, null, 2));

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
    // Parse request body
    const body = event.body || '';
    const isBase64 = event.isBase64Encoded;
    const decodedBody = isBase64 ? Buffer.from(body, 'base64').toString('utf-8') : body;
    
    const params = parseFormBody(decodedBody);
    const password = params.password;

    console.log('Password received:', password ? 'yes' : 'no');

    // Validate password exists
    if (!password) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Password is required</div>',
      };
    }

    // Retrieve secrets from Secrets Manager
    const secrets = await getSecrets();

    // Verify password
    const isValid = await bcrypt.compare(password, secrets.passwordHash);

    if (!isValid) {
      console.log('Invalid password attempt');
      return {
        statusCode: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
        body: '<div class="error">Invalid password</div>',
      };
    }

    // Generate JWT token
    const token = await generateToken();
    console.log('Authentication successful, token generated');

    // Return success with token in custom header
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'X-Auth-Token': token,
      },
      body: '<div class="success">Login successful! Redirecting...</div>',
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
      body: '<div class="error">Internal server error</div>',
    };
  }
}
