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
    - [10.1 Custom Domain with Route 53 & SSL](#101-custom-domain-with-route-53--ssl)
    - [10.2 CloudWatch Alarms](#102-cloudwatch-alarms)
    - [10.3 Cost Optimization](#103-cost-optimization)
    - [10.4 Security Hardening](#104-security-hardening)

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
- Route 53 (if setting up custom domains)
- Certificate Manager (if setting up SSL/TLS certificates)

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

### 3.2 CloudFront Origin Access Control (OAC)

Origin Access Control (OAC) is the modern replacement for the legacy Origin Access Identity (OAI). It provides better security and supports additional AWS features.

**⚠️ You can skip this section during initial setup!** The OAC will be automatically created when you set up CloudFront in Section 6.1. CloudFront will also generate the required S3 bucket policy for you to copy and paste.

**This section is provided for reference only** - to explain what OAC is and show manual/CLI methods if needed.

**Via AWS Console:**

The OAC will be created automatically when you set up CloudFront in Section 6.1. After creating the distribution:

1. CloudFront will display a banner: **"The S3 bucket policy needs to be updated"**
2. Click **Copy policy**
3. Navigate to your S3 bucket
4. Go to **Permissions** → **Bucket policy**
5. Paste the policy and click **Save**

**Example S3 Bucket Policy (auto-generated by CloudFront):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-domain-static/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID"
        }
      }
    }
  ]
}
```

**Via AWS CLI:**

```bash
# Create OAC (if not created via console)
aws cloudfront create-origin-access-control \
  --origin-access-control-config \
  "Name=pdf-static-oac,\
   Description=OAC for PDF Directory static bucket,\
   SigningProtocol=sigv4,\
   SigningBehavior=always,\
   OriginAccessControlOriginType=s3"

# Get OAC ID
OAC_ID=$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='pdf-static-oac'].Id" \
  --output text)

echo "OAC ID: $OAC_ID"
```

**Key Differences from Legacy OAI:**

- **Better Security**: Uses AWS Signature Version 4 (SigV4) for authentication
- **More AWS Features**: Supports SSE-KMS encrypted objects, SSE-C, and other S3 features
- **Service Principal**: Uses CloudFront service principal instead of IAM user
- **Condition-based Access**: Restricts access to specific CloudFront distributions

**Applying S3 Bucket Policy via CLI:**

After creating your CloudFront distribution, get its ID and apply the bucket policy:

```bash
# Get your distribution ID
DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[0].Id" \
  --output text)

# Get your AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Create bucket policy file
cat > static-bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-domain-static/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
        }
      }
    }
  ]
}
EOF

# Apply policy to bucket
aws s3api put-bucket-policy \
  --bucket your-domain-static \
  --policy file://static-bucket-policy.json
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
2. **Alternate domain name (CNAME)**: Leave blank for now (will be configured in Section 10.1)
3. **Custom SSL certificate**: Leave as default for now (will be configured in Section 10.1)

**Note:** If you plan to use a custom domain like `6thward-fh.theburtonforge.com`, you'll configure this later in Section 10.1. For initial setup, you can use the CloudFront domain directly.

Click **Create distribution**

**Update S3 Static Bucket Policy:**

After creating distribution, CloudFront will display a banner saying **"The S3 bucket policy needs to be updated"**. Click **Copy policy**, then:

1. Navigate to your S3 static bucket
2. Go to **Permissions** → **Bucket policy**
3. Paste the CloudFront-generated policy
4. Click **Save**

This policy uses Origin Access Control (OAC) to securely grant CloudFront access to your private S3 bucket.

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
  --cli-binary-format raw-in-base64-out \
  --payload '{"httpMethod":"POST","body":"password=yourpassword"}' \
  response.json

cat response.json
```

**Note:** The `--cli-binary-format raw-in-base64-out` flag is required to prevent payload encoding issues.

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

# Custom Domains (Optional - see Section 10.1)
CLOUDFRONT_CUSTOM_DOMAIN=6thward-fh.theburtonforge.com
API_CUSTOM_DOMAIN=6thward-fh.api.theburtonforge.com
HOSTED_ZONE_ID=Z1234567890ABC
SSL_CERTIFICATE_ARN=arn:aws:acm:us-east-1:123456789012:certificate/abc-def-123
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

### Custom Domain - SSL Certificate Validation Delays

**Symptom:** Certificate stuck in "Pending Validation" status

**Solution:**
- Verify CNAME records were created in Route 53 for DNS validation
- Check that CNAME records match exactly what ACM requires
- Wait 5-30 minutes for validation to complete
- If using external DNS provider, ensure CNAME records are propagated:
  ```bash
  dig _validation-string.6thward-fh.theburtonforge.com CNAME
  ```
- Certificate must be in `us-east-1` region for CloudFront

### Custom Domain - DNS Not Resolving

**Symptom:** Domain doesn't resolve or shows old IP

**Solution:**
- Verify Route 53 nameservers are set at your domain registrar
- Check nameserver propagation:
  ```bash
  dig NS theburtonforge.com
  nslookup -type=NS theburtonforge.com
  ```
- DNS propagation can take 24-48 hours globally
- Clear local DNS cache:
  - macOS: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
  - Windows: `ipconfig /flushdns`
  - Linux: `sudo systemd-resolve --flush-caches`
- Test with Google DNS: `dig @8.8.8.8 6thward-fh.theburtonforge.com`

### Custom Domain - CloudFront CNAME Already Exists

**Symptom:** Error when adding alternate domain name to CloudFront

**Solution:**
- Each CNAME can only be associated with one CloudFront distribution
- Check if domain is already in use by another distribution:
  ```bash
  aws cloudfront list-distributions \
    --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '6thward-fh.theburtonforge.com')]"
  ```
- Remove domain from old distribution before adding to new one

### Custom Domain - API Gateway 403 Forbidden

**Symptom:** Custom domain returns 403, but API Gateway URL works

**Solution:**
- Verify base path mapping is configured correctly
- Check that API Gateway custom domain shows "Available" status
- Ensure Route 53 A record points to correct API Gateway regional domain name
- Verify SSL certificate includes the API domain name
- Wait 5-10 minutes for API Gateway custom domain to fully deploy

### Custom Domain - Mixed Content Warnings

**Symptom:** Browser shows "Not Secure" or mixed content warnings

**Solution:**
- Ensure all resources (CSS, JS, images) are loaded via HTTPS
- Update hardcoded HTTP URLs to HTTPS
- Verify CloudFront is serving content over HTTPS
- Check that API calls use `https://` not `http://`

### Custom Domain - Certificate Not Showing in CloudFront

**Symptom:** Can't select SSL certificate when configuring CloudFront

**Solution:**
- Certificate **must** be in `us-east-1` region for CloudFront (edge-optimized)
- Verify certificate status is "Issued" not "Pending"
- Ensure certificate includes the exact domain name you're adding to CloudFront
- Refresh the CloudFront console page

---

## 10. Optional Advanced Setup

## 10. Optional Advanced Setup

### 10.1 Custom Domain with Route 53 & SSL

This section covers setting up custom domains for your PDF Directory application:
- **App Domain**: `6thward-fh.theburtonforge.com` (served via CloudFront)
- **API Domain**: `6thward-fh.api.theburtonforge.com` (served via API Gateway)

#### Prerequisites

- Own the domain `theburtonforge.com`
- Domain is registered with any registrar (Route 53, GoDaddy, Namecheap, etc.)
- Access to domain's DNS settings

#### 10.1.1 Route 53 Hosted Zone Setup

**Check for Existing Hosted Zone:**

```bash
aws route53 list-hosted-zones --query "HostedZones[?Name=='theburtonforge.com.']"
```

If the hosted zone doesn't exist, create it:

**Via AWS Console:**

1. Navigate to [Route 53 Console](https://console.aws.amazon.com/route53/)
2. Click **Hosted zones** → **Create hosted zone**
3. **Domain name**: `theburtonforge.com`
4. **Description**: `Hosted zone for The Burton Forge domain`
5. **Type**: Public hosted zone
6. Click **Create hosted zone**

**Note the Name Servers:**

After creation, you'll see 4 nameservers (NS records) like:
- `ns-1234.awsdns-56.org`
- `ns-789.awsdns-12.com`
- `ns-345.awsdns-67.net`
- `ns-890.awsdns-34.co.uk`

**Via AWS CLI:**

```bash
aws route53 create-hosted-zone \
  --name theburtonforge.com \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="The Burton Forge hosted zone"

# Get the hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='theburtonforge.com.'].Id" \
  --output text | cut -d'/' -f3)

echo "Hosted Zone ID: $HOSTED_ZONE_ID"
```

**Update Domain Registrar Nameservers:**

If your domain is NOT registered with Route 53, you need to update the nameservers at your domain registrar:

1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS settings for `theburtonforge.com`
3. Replace existing nameservers with the 4 AWS nameservers from above
4. Save changes

**Note:** DNS propagation can take 24-48 hours. You can check status with:

```bash
dig NS theburtonforge.com
# or
nslookup -type=NS theburtonforge.com
```

#### 10.1.2 SSL Certificate Setup (AWS Certificate Manager)

SSL certificates for CloudFront **must** be created in `us-east-1` region, regardless of where your other resources are located.

**Via AWS Console:**

1. Navigate to [ACM Console (us-east-1)](https://console.aws.amazon.com/acm/home?region=us-east-1)
2. **Important:** Ensure you're in `us-east-1` region (check top-right)
3. Click **Request a certificate**
4. **Certificate type**: Request a public certificate
5. Click **Next**

**Domain names:**

Add both subdomains:
- `6thward-fh.theburtonforge.com`
- `6thward-fh.api.theburtonforge.com`

Click **Add another name to this certificate** to add the second domain.

6. **Validation method**: DNS validation (recommended)
7. **Key algorithm**: RSA 2048
8. Click **Request**

**DNS Validation (Automatic via Route 53):**

1. After requesting, click on the certificate ARN
2. For each domain name, you'll see **CNAME name** and **CNAME value**
3. Click **Create records in Route 53** button
4. Select both domains
5. Click **Create records**

Route 53 will automatically add the CNAME records for validation.

**Wait for validation** (typically 5-15 minutes):

```bash
# Check certificate status
aws acm list-certificates --region us-east-1 \
  --certificate-statuses ISSUED PENDING_VALIDATION

# Get specific certificate details
aws acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID \
  --region us-east-1
```

**Via AWS CLI:**

```bash
# Request certificate (must be in us-east-1)
CERT_ARN=$(aws acm request-certificate \
  --region us-east-1 \
  --domain-name 6thward-fh.theburtonforge.com \
  --subject-alternative-names 6thward-fh.api.theburtonforge.com \
  --validation-method DNS \
  --query 'CertificateArn' \
  --output text)

echo "Certificate ARN: $CERT_ARN"

# Get validation records
aws acm describe-certificate \
  --region us-east-1 \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[*].[DomainName,ResourceRecord.Name,ResourceRecord.Value]' \
  --output table
```

**Manual DNS Validation (if not using Route 53 auto-validation):**

If you need to manually add CNAME records, use the values from the certificate:

```bash
# For each domain, create a CNAME record in Route 53:
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_VALIDATION_NAME_FROM_ACM",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "_VALIDATION_VALUE_FROM_ACM"}]
      }
    }]
  }'
```

**Save the Certificate ARN** - you'll need it for CloudFront and API Gateway configuration.

#### 10.1.3 CloudFront Custom Domain Configuration

Now update your CloudFront distribution to use the custom domain.

**Via AWS Console:**

1. Navigate to [CloudFront Console](https://console.aws.amazon.com/cloudfront/)
2. Select your distribution
3. Click **Edit**
4. Scroll to **Settings** section

**Update Settings:**

1. **Alternate domain names (CNAMEs)**: Add `6thward-fh.theburtonforge.com`
2. **Custom SSL certificate**: Select the certificate you created (should show both domains)
3. Click **Save changes**

**Wait for deployment** (10-15 minutes):

```bash
# Check distribution status
aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID \
  --query 'Distribution.Status' --output text
```

**Via AWS CLI:**

```bash
# Get current distribution config
aws cloudfront get-distribution-config \
  --id YOUR_DISTRIBUTION_ID > distribution-config.json

# Edit the config to add alternate domain name and SSL certificate
# Then update:
aws cloudfront update-distribution \
  --id YOUR_DISTRIBUTION_ID \
  --if-match ETAG_FROM_GET_COMMAND \
  --distribution-config file://distribution-config-updated.json
```

**Create Route 53 Alias Record for CloudFront:**

**Via AWS Console:**

1. Go to [Route 53 Console](https://console.aws.amazon.com/route53/)
2. Select your hosted zone (`theburtonforge.com`)
3. Click **Create record**
4. **Record name**: `6thward-fh`
5. **Record type**: A - IPv4 address
6. **Alias**: Toggle ON
7. **Route traffic to**: Alias to CloudFront distribution
8. **Region**: Select your region
9. **Choose distribution**: Select your CloudFront distribution
10. Click **Create records**

**Via AWS CLI:**

```bash
# Get CloudFront distribution domain name
CF_DOMAIN=$(aws cloudfront get-distribution \
  --id YOUR_DISTRIBUTION_ID \
  --query 'Distribution.DomainName' \
  --output text)

# Create A record (Alias) pointing to CloudFront
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "6thward-fh.theburtonforge.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "'$CF_DOMAIN'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**Note:** `Z2FDTNDATAQYW2` is the fixed hosted zone ID for all CloudFront distributions.

#### 10.1.4 API Gateway Custom Domain Configuration

Set up a custom domain for your API to use `6thward-fh.api.theburtonforge.com`.

**Via AWS Console:**

1. Navigate to [API Gateway Console](https://console.aws.amazon.com/apigateway/)
2. In the left sidebar, click **Custom domain names**
3. Click **Create**

**Configuration:**

1. **Domain name**: `6thward-fh.api.theburtonforge.com`
2. **TLS version**: TLS 1.2 (recommended)
3. **Endpoint type**: Regional
4. **ACM certificate**: Select the certificate containing `6thward-fh.api.theburtonforge.com`
5. Click **Create domain name**

**Configure API Mappings:**

After creation:

1. Click on the **API mappings** tab
2. Click **Configure API mappings**
3. Click **Add new mapping**
4. **API**: Select `pdf-directory-api`
5. **Stage**: `prod`
6. **Path**: Leave empty (maps to root)
7. Click **Save**

**Get API Gateway Domain Name:**

The custom domain will have a **Target domain name** like:
`d-abc123.execute-api.us-east-1.amazonaws.com`

Save this value for the next step.

**Via AWS CLI:**

```bash
# Create custom domain
aws apigateway create-domain-name \
  --domain-name 6thward-fh.api.theburtonforge.com \
  --regional-certificate-arn $CERT_ARN \
  --endpoint-configuration types=REGIONAL

# Get the target domain name
API_TARGET_DOMAIN=$(aws apigateway get-domain-name \
  --domain-name 6thward-fh.api.theburtonforge.com \
  --query 'regionalDomainName' \
  --output text)

echo "API Target Domain: $API_TARGET_DOMAIN"

# Create base path mapping
aws apigateway create-base-path-mapping \
  --domain-name 6thward-fh.api.theburtonforge.com \
  --rest-api-id YOUR_API_ID \
  --stage prod
```

**Create Route 53 Alias Record for API Gateway:**

**Via AWS Console:**

1. Go to [Route 53 Console](https://console.aws.amazon.com/route53/)
2. Select your hosted zone (`theburtonforge.com`)
3. Click **Create record**
4. **Record name**: `6thward-fh.api`
5. **Record type**: A - IPv4 address
6. **Alias**: Toggle ON
7. **Route traffic to**: Alias to API Gateway API
8. **Region**: Select your region (e.g., us-east-1)
9. **Choose endpoint**: Select your API custom domain
10. Click **Create records**

**Via AWS CLI:**

```bash
# Get API Gateway hosted zone ID for your region
# For us-east-1, it's Z1UJRXOUMOOFQ8
# For other regions, see: https://docs.aws.amazon.com/general/latest/gr/apigateway.html

API_HOSTED_ZONE_ID="Z1UJRXOUMOOFQ8"  # us-east-1

# Create A record (Alias) pointing to API Gateway
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "6thward-fh.api.theburtonforge.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "'$API_HOSTED_ZONE_ID'",
          "DNSName": "'$API_TARGET_DOMAIN'",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**API Gateway Hosted Zone IDs by Region:**
- `us-east-1`: Z1UJRXOUMOOFQ8
- `us-east-2`: Z2OJLYMUO9EFXC
- `us-west-1`: Z2MUQ32089INYE
- `us-west-2`: Z1HQZ1KZ3SPZE
- See [AWS Documentation](https://docs.aws.amazon.com/general/latest/gr/apigateway.html) for other regions

#### 10.1.5 Update Lambda Environment Variables

Update your Lambda functions to use the custom domain for CORS.

**Via AWS Console:**

For each Lambda function (`pdf-auth`, `pdf-upload`, `pdf-list-pdfs`):

1. Navigate to [Lambda Console](https://console.aws.amazon.com/lambda/)
2. Select the function
3. Go to **Configuration** → **Environment variables**
4. Edit `ALLOWED_ORIGINS`:
   - Change from: `*`
   - Change to: `https://6thward-fh.theburtonforge.com`
5. Click **Save**

**Via AWS CLI:**

```bash
# Update each function
aws lambda update-function-configuration \
  --function-name pdf-auth \
  --environment "Variables={JWT_SECRET=your-secret,PASSWORD_HASH=your-hash,ALLOWED_ORIGINS=https://6thward-fh.theburtonforge.com}"

aws lambda update-function-configuration \
  --function-name pdf-upload \
  --environment "Variables={JWT_SECRET=your-secret,PDF_BUCKET_NAME=your-domain-pdfs,ALLOWED_ORIGINS=https://6thward-fh.theburtonforge.com}"

aws lambda update-function-configuration \
  --function-name pdf-list-pdfs \
  --environment "Variables={JWT_SECRET=your-secret,PDF_BUCKET_NAME=your-domain-pdfs,ALLOWED_ORIGINS=https://6thward-fh.theburtonforge.com}"
```

#### 10.1.6 Update CORS Configuration

Update CORS settings on S3 buckets to restrict to your custom domain.

**Update Static Bucket CORS:**

Edit `cors-static.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://6thward-fh.theburtonforge.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Apply:

```bash
aws s3api put-bucket-cors \
  --bucket your-domain-static \
  --cors-configuration file://cors-static.json
```

**Update PDFs Bucket CORS:**

Edit `cors-pdfs.json`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["https://6thward-fh.theburtonforge.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

Apply:

```bash
aws s3api put-bucket-cors \
  --bucket your-domain-pdfs \
  --cors-configuration file://cors-pdfs.json
```

#### 10.1.7 Verification

**Test DNS Resolution:**

```bash
# Test app domain
dig 6thward-fh.theburtonforge.com
nslookup 6thward-fh.theburtonforge.com

# Test API domain
dig 6thward-fh.api.theburtonforge.com
nslookup 6thward-fh.api.theburtonforge.com
```

**Test HTTPS Access:**

```bash
# Test app (should return your index.html)
curl -I https://6thward-fh.theburtonforge.com

# Test API (should return 401 without auth)
curl -I https://6thward-fh.api.theburtonforge.com/api/pdfs

# Test SSL certificate
openssl s_client -connect 6thward-fh.theburtonforge.com:443 -servername 6thward-fh.theburtonforge.com
```

**Browser Test:**

1. Navigate to `https://6thward-fh.theburtonforge.com`
2. Verify SSL certificate shows valid (lock icon)
3. Test login functionality
4. Upload a PDF
5. Verify API calls work to `6thward-fh.api.theburtonforge.com`

**Update Frontend Configuration:**

If your frontend has hardcoded API URLs, update them to use the custom domain:

```javascript
// Before
const API_URL = 'https://abc123.execute-api.us-east-1.amazonaws.com/prod';

// After
const API_URL = 'https://6thward-fh.api.theburtonforge.com';
```

#### 10.1.8 Summary

After completing this setup, your infrastructure will be:

- **App URL**: `https://6thward-fh.theburtonforge.com` → CloudFront → S3
- **API URL**: `https://6thward-fh.api.theburtonforge.com` → API Gateway → Lambda
- **SSL**: Managed by AWS Certificate Manager (auto-renewal)
- **DNS**: Managed by Route 53
- **CORS**: Restricted to your custom domain

**Benefits:**
- Professional, branded URLs
- Better SEO and user trust
- Simplified API endpoints (no stage names in URL)
- Centralized DNS management
- Automatic SSL certificate renewal

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
