# AWS Infrastructure Setup Guide

Complete step-by-step guide for setting up all AWS infrastructure for the PDF Directory Website.

## Table of Contents

1. [Prerequisites & AWS CLI Setup](#1-prerequisites--aws-cli-setup)
2. [S3 Bucket Creation](#2-s3-bucket-creation)
3. [IAM Roles & Policies](#3-iam-roles--policies)
4. [Lambda Function Setup](#4-lambda-function-setup)
5. [API Gateway Configuration](#5-api-gateway-configuration)
6. [CloudFront Distribution](#6-cloudfront-distribution)
7. [Testing & Verification](#7-testing--verification)
8. [Environment Configuration](#8-environment-configuration)
9. [Troubleshooting](#9-troubleshooting)
10. [Optional Advanced Setup](#10-optional-advanced-setup)

---

## 1. Prerequisites & AWS CLI Setup

### 1.1 AWS Account

You need an active AWS account. Sign up at [aws.amazon.com](https://aws.amazon.com) if you don't have one.

### 1.2 Install AWS CLI

**macOS (Homebrew):**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Windows:**
Download from [AWS CLI Downloads](https://aws.amazon.com/cli/)

### 1.3 Configure AWS CLI

```bash
aws configure
```

Enter:
- **AWS Access Key ID**: Your IAM access key
- **AWS Secret Access Key**: Your IAM secret key
- **Default region**: `us-east-1` (recommended)
- **Default output format**: `json`

### 1.4 Verify Configuration

```bash
aws sts get-caller-identity
```

You should see your account details.

### 1.5 Required IAM Permissions

Your IAM user needs permissions for:
- S3 (full access for bucket creation and management)
- Lambda (full access for function creation and deployment)
- API Gateway (full access)
- CloudFront (full access)
- IAM (for creating roles and policies)

**Recommended Policy:** `AdministratorAccess` for initial setup, or create a custom policy with the above services.

---

## 2. S3 Bucket Creation

### 2.1 Static Website Bucket

**Via AWS Console:**

1. Navigate to [S3 Console](https://console.aws.amazon.com/s3/)
2. Click **"Create bucket"**
3. **Bucket name**: `your-domain-static` (must be globally unique)
4. **Region**: `us-east-1`
5. **Block Public Access**: Keep all blocked (CloudFront will access via OAI)
6. Click **"Create bucket"**

**Enable Static Website Hosting:**

1. Select your bucket
2. Go to **Properties** tab
3. Scroll to **Static website hosting**
4. Click **Edit**
5. Enable **Static website hosting**
6. **Index document**: `index.html`
7. **Error document**: `index.html`
8. Click **Save changes**

**Via AWS CLI:**

```bash
# Create bucket
aws s3 mb s3://your-domain-static --region us-east-1

# Enable static website hosting
aws s3 website s3://your-domain-static \
  --index-document index.html \
  --error-document index.html
```

**CORS Configuration:**

Create a file `cors-static.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Apply CORS:

```bash
aws s3api put-bucket-cors \
  --bucket your-domain-static \
  --cors-configuration file://cors-static.json
```

### 2.2 PDFs Bucket

**Via AWS Console:**

1. Click **"Create bucket"**
2. **Bucket name**: `your-domain-pdfs` (must be globally unique)
3. **Region**: `us-east-1`
4. **Block Public Access**: **Uncheck** "Block all public access" (PDFs are public)
5. Acknowledge the warning
6. Click **"Create bucket"**

**Via AWS CLI:**

```bash
# Create bucket
aws s3 mb s3://your-domain-pdfs --region us-east-1

# Enable public read access
aws s3api put-public-access-block \
  --bucket your-domain-pdfs \
  --public-access-block-configuration \
  "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

**Bucket Policy for Public Read:**

Create `bucket-policy-pdfs.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-domain-pdfs/*"
    }
  ]
}
```

Apply policy:

```bash
aws s3api put-bucket-policy \
  --bucket your-domain-pdfs \
  --policy file://bucket-policy-pdfs.json
```

**CORS for PDFs Bucket:**

Create `cors-pdfs.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Apply CORS:

```bash
aws s3api put-bucket-cors \
  --bucket your-domain-pdfs \
  --cors-configuration file://cors-pdfs.json
```

---

## 3. IAM Roles & Policies

### 3.1 Lambda Execution Role

**Via AWS Console:**

1. Navigate to [IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Roles** → **Create role**
3. **Trusted entity**: AWS service
4. **Use case**: Lambda
5. Click **Next**
6. Attach policies:
   - `AWSLambdaBasicExecutionRole` (for CloudWatch logs)
7. Click **Next**
8. **Role name**: `pdf-lambda-execution-role`
9. Click **Create role**

**Add S3 Permissions:**

1. Find and select your new role
2. Click **Add permissions** → **Create inline policy**
3. Switch to **JSON** tab
4. Paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-domain-pdfs",
        "arn:aws:s3:::your-domain-pdfs/*"
      ]
    }
  ]
}
```

5. Click **Review policy**
6. **Name**: `S3-PDFs-Access`
7. Click **Create policy**

**Via AWS CLI:**

Create `lambda-trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Create role:

```bash
aws iam create-role \
  --role-name pdf-lambda-execution-role \
  --assume-role-policy-document file://lambda-trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
  --role-name pdf-lambda-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach S3 policy
aws iam put-role-policy \
  --role-name pdf-lambda-execution-role \
  --policy-name S3-PDFs-Access \
  --policy-document file://s3-policy.json
```

**Get Role ARN (save this):**

```bash
aws iam get-role --role-name pdf-lambda-execution-role --query 'Role.Arn' --output text
```

### 3.2 CloudFront Origin Access Identity (OAI)

**Via AWS Console:**

1. Navigate to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click **Origin access** → **Create origin access identity**
3. **Name**: `pdf-directory-static-oai`
4. Click **Create**

**Update S3 Static Bucket Policy:**

Add this to your static bucket policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFrontOAI",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity YOUR_OAI_ID"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-domain-static/*"
    }
  ]
}
```

**Via AWS CLI:**

```bash
# Create OAI
aws cloudfront create-cloud-front-origin-access-identity \
  --cloud-front-origin-access-identity-config \
  "CallerReference=$(date +%s),Comment=PDF Directory Static OAI"
```

---

## 4. Lambda Function Setup

### 4.1 Create Lambda Functions

You'll create 3 Lambda functions: `pdf-auth`, `pdf-upload`, and `pdf-list-pdfs`.

**Via AWS Console (for each function):**

1. Navigate to [Lambda Console](https://console.aws.amazon.com/lambda/)
2. Click **Create function**
3. **Author from scratch**
4. **Function name**: `pdf-auth` (or `pdf-upload`, `pdf-list-pdfs`)
5. **Runtime**: Node.js 18.x or later
6. **Architecture**: x86_64
7. **Execution role**: Use existing role → `pdf-lambda-execution-role`
8. Click **Create function**

**Configure Each Function:**

1. **General configuration**:
   - Memory: 512 MB
   - Timeout: 30 seconds

2. **Environment variables** (add these):
   - `JWT_SECRET`: Your JWT secret
   - `PASSWORD_HASH`: Bcrypt hash of your password
   - `PDF_BUCKET_NAME`: `your-domain-pdfs`
   - `ALLOWED_ORIGINS`: `*` (or your CloudFront domain)

**Via AWS CLI:**

```bash
# Get your role ARN first
ROLE_ARN=$(aws iam get-role --role-name pdf-lambda-execution-role --query 'Role.Arn' --output text)

# Create auth function (placeholder code)
aws lambda create-function \
  --function-name pdf-auth \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://placeholder.zip \
  --timeout 30 \
  --memory-size 512

# Create upload function
aws lambda create-function \
  --function-name pdf-upload \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://placeholder.zip \
  --timeout 30 \
  --memory-size 512

# Create list function
aws lambda create-function \
  --function-name pdf-list-pdfs \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://placeholder.zip \
  --timeout 30 \
  --memory-size 512
```

**Add Environment Variables:**

```bash
aws lambda update-function-configuration \
  --function-name pdf-auth \
  --environment "Variables={JWT_SECRET=your-secret,PASSWORD_HASH=your-hash,ALLOWED_ORIGINS=*}"

aws lambda update-function-configuration \
  --function-name pdf-upload \
  --environment "Variables={JWT_SECRET=your-secret,PDF_BUCKET_NAME=your-domain-pdfs}"

aws lambda update-function-configuration \
  --function-name pdf-list-pdfs \
  --environment "Variables={JWT_SECRET=your-secret,PDF_BUCKET_NAME=your-domain-pdfs}"
```

### 4.2 Generate Password Hash

To generate bcrypt hash for your password:

```bash
node -e "console.log(require('bcryptjs').hashSync('YourPassword', 10))"
```

Or use an online tool: [bcrypt-generator.com](https://bcrypt-generator.com/)

---

## 5. API Gateway Configuration

### 5.1 Create REST API

**Via AWS Console:**

1. Navigate to [API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. Click **Create API**
3. Choose **REST API** (not private)
4. Click **Build**
5. **API name**: `pdf-directory-api`
6. **Endpoint Type**: Regional
7. Click **Create API**

### 5.2 Create Resources and Methods

**Create /api resource:**

1. Click **Actions** → **Create Resource**
2. **Resource Name**: `api`
3. **Resource Path**: `/api`
4. Check **Enable API Gateway CORS**
5. Click **Create Resource**

**Create /api/auth (POST):**

1. Select `/api` resource
2. Click **Actions** → **Create Resource**
3. **Resource Name**: `auth`
4. Click **Create Resource**
5. Select `/api/auth` resource
6. Click **Actions** → **Create Method** → **POST**
7. **Integration type**: Lambda Function
8. Check **Use Lambda Proxy integration**
9. **Lambda Function**: `pdf-auth`
10. Click **Save** → **OK**

**Enable CORS:**

1. Select `/api/auth`
2. Click **Actions** → **Enable CORS**
3. Keep defaults
4. Click **Enable CORS and replace existing CORS headers**

**Create /api/pdfs (GET):**

1. Select `/api` resource
2. Click **Actions** → **Create Resource**
3. **Resource Name**: `pdfs`
4. Click **Create Resource**
5. Select `/api/pdfs` resource
6. Click **Actions** → **Create Method** → **GET**
7. **Integration type**: Lambda Function
8. Check **Use Lambda Proxy integration**
9. **Lambda Function**: `pdf-list-pdfs`
10. Click **Save** → **OK**
11. Enable CORS (same as above)

**Create /api/upload (POST):**

1. Select `/api` resource
2. Click **Actions** → **Create Resource**
3. **Resource Name**: `upload`
4. Click **Create Resource**
5. Select `/api/upload` resource
6. Click **Actions** → **Create Method** → **POST**
7. **Integration type**: Lambda Function
8. Check **Use Lambda Proxy integration**
9. **Lambda Function**: `pdf-upload`
10. Click **Save** → **OK**
11. Enable CORS

### 5.3 Deploy API

1. Click **Actions** → **Deploy API**
2. **Deployment stage**: [New Stage]
3. **Stage name**: `prod`
4. Click **Deploy**

**Get API URL:**

After deployment, note the **Invoke URL** at the top (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod`)

**Via AWS CLI:**

```bash
# Create API
API_ID=$(aws apigateway create-rest-api \
  --name pdf-directory-api \
  --endpoint-configuration types=REGIONAL \
  --query 'id' --output text)

# Get root resource ID
ROOT_ID=$(aws apigateway get-resources \
  --rest-api-id $API_ID \
  --query 'items[0].id' --output text)

# Create /api resource
API_RESOURCE_ID=$(aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $ROOT_ID \
  --path-part api \
  --query 'id' --output text)

# Continue with more CLI commands for each resource/method...
# (This gets complex, Console is recommended for API Gateway)
```

---

## 6. CloudFront Distribution

### 6.1 Create Distribution

**Via AWS Console:**

1. Navigate to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Click **Create distribution**

**Origin 1 - Static Website Bucket:**

1. **Origin domain**: Select your `your-domain-static` S3 bucket
2. **Origin access**: Origin access control settings (recommended)
3. Click **Create control setting**
   - Name: `pdf-static-oac`
   - Click **Create**
4. **Origin shield**: No

**Default Cache Behavior:**

1. **Viewer protocol policy**: Redirect HTTP to HTTPS
2. **Allowed HTTP methods**: GET, HEAD
3. **Cache policy**: CachingOptimized
4. **Origin request policy**: None

**Additional Origins:**

Click **Add origin**:

**Origin 2 - PDFs Bucket:**

1. **Origin domain**: Select your `your-domain-pdfs` S3 bucket
2. **Origin access**: Public (bucket allows public access)

**Origin 3 - API Gateway:**

1. **Origin domain**: Your API Gateway domain (e.g., `abc123.execute-api.us-east-1.amazonaws.com`)
2. **Origin path**: `/prod` (your stage name)
3. **Protocol**: HTTPS only

**Additional Behaviors:**

Click **Add behavior**:

**Behavior for PDFs:**

1. **Path pattern**: `*.pdf`
2. **Origin**: Select PDFs bucket origin
3. **Viewer protocol policy**: Redirect HTTP to HTTPS
4. **Cache policy**: CachingOptimized

**Behavior for API:**

1. **Path pattern**: `/api/*`
2. **Origin**: Select API Gateway origin
3. **Viewer protocol policy**: Redirect HTTP to HTTPS
4. **Cache policy**: CachingDisabled
5. **Origin request policy**: AllViewer
6. **Allowed HTTP methods**: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE

**Settings:**

1. **Price class**: Use all edge locations (or choose based on your needs)
2. **Alternate domain name (CNAME)**: (Optional) your custom domain
3. **Custom SSL certificate**: (Optional) select ACM certificate

Click **Create distribution**

**Update S3 Static Bucket Policy:**

After creating distribution, CloudFront will provide a policy to update your static bucket. Copy and apply it.

**Via AWS CLI:**

```bash
# This is complex with CLI, Console is strongly recommended
# See AWS documentation for full CLI distribution creation
```

**Get CloudFront Domain:**

After creation, note your distribution domain (e.g., `d123456.cloudfront.net`)

---

## 7. Testing & Verification

### 7.1 Test Lambda Functions

**Test auth function:**

```bash
aws lambda invoke \
  --function-name pdf-auth \
  --payload '{"body":"password=yourpassword"}' \
  response.json

cat response.json
```

### 7.2 Test API Gateway

```bash
# Test auth endpoint
curl -X POST https://YOUR_API_URL/prod/api/auth \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "password=yourpassword"

# Test list PDFs (with JWT from auth)
curl https://YOUR_API_URL/prod/api/pdfs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7.3 Test S3 Buckets

```bash
# Upload test file to static bucket
echo "Test" > test.txt
aws s3 cp test.txt s3://your-domain-static/

# Verify via CloudFront
curl https://YOUR_CLOUDFRONT_DOMAIN/test.txt
```

### 7.4 End-to-End Test

1. Access CloudFront domain in browser
2. Should see login page
3. Enter password
4. Should redirect to directory page
5. Upload a PDF
6. PDF should appear in list
7. Click PDF link - should open publicly

---

## 8. Environment Configuration

Update your `.env` file with all values:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_PROFILE=default

# S3 Buckets
STATIC_BUCKET_NAME=your-actual-bucket-name-static
PDF_BUCKET_NAME=your-actual-bucket-name-pdfs

# CloudFront
CLOUDFRONT_ID=E1234567890ABC
CLOUDFRONT_DOMAIN=d123456.cloudfront.net

# API Gateway
API_GATEWAY_ID=abc123defg
API_GATEWAY_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod

# Lambda Functions
AUTH_LAMBDA_NAME=pdf-auth
UPLOAD_LAMBDA_NAME=pdf-upload
LIST_LAMBDA_NAME=pdf-list-pdfs

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
PASSWORD_HASH=$2b$10$YourActualBcryptHashHere
```

---

## 9. Troubleshooting

### CORS Errors

**Symptom:** Browser shows CORS error when calling API

**Solution:**
- Verify CORS is enabled on API Gateway methods
- Check API Gateway response includes CORS headers
- Ensure CloudFront behavior for /api/* has proper cache settings

### 403 Forbidden from S3

**Symptom:** Can't access files through CloudFront

**Solution:**
- Verify bucket policy allows CloudFront OAI access
- Check CloudFront distribution has correct origin settings
- Wait 10-15 minutes for CloudFront distribution to deploy

### Lambda Timeout

**Symptom:** API Gateway returns 504 Gateway Timeout

**Solution:**
- Increase Lambda timeout (Configuration → General → Timeout)
- Check Lambda logs in CloudWatch
- Verify Lambda has network access (if VPC-enabled)

### CloudFront Cache Issues

**Symptom:** Old content showing after update

**Solution:**
- Create cache invalidation:
  ```bash
  aws cloudfront create-invalidation \
    --distribution-id YOUR_DIST_ID \
    --paths "/*"
  ```

### API Gateway Authorization Failures

**Symptom:** 401 Unauthorized even with valid JWT

**Solution:**
- Verify JWT secret matches between auth and other Lambdas
- Check JWT expiration time
- Verify Authorization header format: `Bearer <token>`

---

## 10. Optional Advanced Setup

### 10.1 Custom Domain with Route 53

1. Register or transfer domain to Route 53
2. Request SSL certificate in ACM (must be in us-east-1)
3. Validate certificate
4. Add alternate domain to CloudFront distribution
5. Create Route 53 A record (Alias) pointing to CloudFront

### 10.2 CloudWatch Alarms

Monitor Lambda errors:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name pdf-auth-errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=FunctionName,Value=pdf-auth \
  --evaluation-periods 1
```

### 10.3 Cost Optimization

1. Set S3 lifecycle policies to archive old PDFs
2. Use CloudFront caching aggressively for static content
3. Set Lambda reserved concurrency if needed
4. Use S3 Intelligent-Tiering for PDFs bucket

### 10.4 Security Hardening

1. Enable AWS WAF on CloudFront
2. Add rate limiting to API Gateway
3. Use AWS Secrets Manager for sensitive env vars
4. Enable CloudTrail logging
5. Add MFA for AWS console access

---

## Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [S3 Documentation](https://docs.aws.amazon.com/s3/)

## Support

For issues with this setup, check:
1. CloudWatch Logs for Lambda errors
2. API Gateway execution logs
3. CloudFront access logs
4. S3 server access logs
