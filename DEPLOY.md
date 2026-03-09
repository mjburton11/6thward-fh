# Deployment Guide

Complete guide for deploying the PDF Directory Website to AWS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Building the Project](#building-the-project)
4. [Deploying Lambda Functions](#deploying-lambda-functions)
5. [Deploying Frontend](#deploying-frontend)
6. [Full Deployment](#full-deployment)
7. [Verification](#verification)
8. [Updating](#updating)
9. [Rollback](#rollback)

---

## Prerequisites

Before deploying, ensure you have:

✅ AWS account with appropriate permissions  
✅ AWS CLI installed and configured (`aws configure`)  
✅ Node.js 18+ and npm installed  
✅ All AWS infrastructure created (see [AWS_SETUP.md](./AWS_SETUP.md))  
✅ `.env` file configured with all values  

## Initial Setup

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install
cd ..

# Install Lambda dependencies
cd lambda/auth
npm install
cd ../upload
npm install
cd ../list-pdfs
npm install
cd ../..
```

### 2. Verify Environment Variables

Ensure your `.env` file has all required values:

```bash
# Check .env file
cat .env

# Required values:
# - AWS_REGION
# - AWS_PROFILE
# - STATIC_BUCKET_NAME
# - PDF_BUCKET_NAME
# - CLOUDFRONT_ID
# - CLOUDFRONT_DOMAIN
# - API_GATEWAY_URL
# - AUTH_LAMBDA_NAME
# - UPLOAD_LAMBDA_NAME
# - LIST_LAMBDA_NAME
# - JWT_SECRET
# - PASSWORD_HASH
```

### 3. Generate Password Hash (if not done)

```bash
# Install bcryptjs globally (if needed)
npm install -g bcryptjs

# Generate hash
node -e "console.log(require('bcryptjs').hashSync('YourPassword', 10))"

# Add output to .env as PASSWORD_HASH
```

---

## Building the Project

### Build Everything

```bash
./scripts/build-all.sh
```

This script:
1. Installs frontend dependencies
2. Compiles frontend TypeScript → JavaScript
3. Installs Lambda dependencies
4. Compiles all Lambda TypeScript → JavaScript

### Build Components Individually

**Frontend only:**

```bash
cd frontend
npm install
npm run build
cd ..
```

**Specific Lambda:**

```bash
cd lambda/auth  # or upload, list-pdfs
npm install
npm run build
cd ../..
```

---

## Deploying Lambda Functions

### Deploy All Lambda Functions

```bash
./scripts/deploy-lambdas.sh
```

This script:
1. Packages each Lambda function with dependencies
2. Creates deployment zip files
3. Updates Lambda function code via AWS CLI
4. Updates environment variables

### Deploy Individual Lambda

```bash
# Build first
cd lambda/auth
npm run build

# Package and deploy
cd dist
cp ../package.json .
npm install --production
zip -r ../function.zip .
cd ..

# Upload to AWS
aws lambda update-function-code \
  --function-name pdf-auth \
  --zip-file fileb://function.zip \
  --region us-east-1

# Update environment variables
aws lambda update-function-configuration \
  --function-name pdf-auth \
  --environment "Variables={JWT_SECRET=your-secret,PASSWORD_HASH=your-hash}" \
  --region us-east-1

cd ../..
```

### Verify Lambda Deployment

```bash
# Check Lambda function
aws lambda get-function --function-name pdf-auth

# Test Lambda function
aws lambda invoke \
  --function-name pdf-auth \
  --payload '{"httpMethod":"OPTIONS"}' \
  response.json

cat response.json
```

---

## Deploying Frontend

### Deploy Frontend to S3

```bash
./scripts/deploy-frontend.sh
```

This script:
1. Builds frontend (if not already built)
2. Syncs `public/` folder to S3 (HTML, CSS)
3. Syncs `dist/` folder to S3 (compiled JS)
4. Invalidates CloudFront cache

### Manual Frontend Deployment

```bash
# Build first
cd frontend
npm run build
cd ..

# Upload HTML and CSS
aws s3 sync frontend/public/ s3://your-bucket-static/ \
  --exclude "*.DS_Store" \
  --cache-control "public, max-age=3600"

# Upload compiled JavaScript
aws s3 sync frontend/dist/ s3://your-bucket-static/dist/ \
  --exclude "*.DS_Store" \
  --cache-control "public, max-age=31536000"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### Verify Frontend Deployment

```bash
# Check S3 contents
aws s3 ls s3://your-bucket-static/

# Test CloudFront URL
curl -I https://your-cloudfront-domain.cloudfront.net/
```

---

## Full Deployment

Deploy everything (build + Lambda + frontend) in one command:

```bash
./scripts/deploy-all.sh
```

This runs:
1. `./scripts/build-all.sh`
2. `./scripts/deploy-lambdas.sh`
3. `./scripts/deploy-frontend.sh`

---

## Verification

### 1. Test Login Page

```bash
# Visit CloudFront URL
open https://your-cloudfront-domain.cloudfront.net/

# Or curl
curl https://your-cloudfront-domain.cloudfront.net/
```

### 2. Test Authentication API

```bash
# Test auth endpoint
curl -X POST https://your-api-url/prod/api/auth \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "password=YourPassword"

# Should return JWT token in X-Auth-Token header and success HTML
```

### 3. Test PDF List API

```bash
# Get JWT token from auth first, then:
curl https://your-api-url/prod/api/pdfs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return HTML list of PDFs
```

### 4. Test Upload (via Browser)

1. Visit CloudFront URL
2. Login with password
3. Upload a test PDF
4. Verify it appears in the list
5. Click PDF link - should open publicly

### 5. Check CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/pdf-auth --follow
aws logs tail /aws/lambda/pdf-upload --follow
aws logs tail /aws/lambda/pdf-list-pdfs --follow
```

---

## Updating

### Update Lambda Code Only

```bash
# Make code changes in lambda/auth/index.ts (or other Lambda)

# Build and deploy
cd lambda/auth
npm run build
cd ../..
./scripts/deploy-lambdas.sh
```

### Update Frontend Only

```bash
# Make changes in frontend/src/ or frontend/public/

# Build and deploy
cd frontend
npm run build
cd ..
./scripts/deploy-frontend.sh
```

### Update Environment Variables

```bash
# Update .env file
vim .env

# Redeploy Lambda functions to update env vars
./scripts/deploy-lambdas.sh
```

### Update Dependencies

```bash
# Update frontend dependencies
cd frontend
npm update
npm run build
cd ..

# Update Lambda dependencies
cd lambda/auth
npm update
cd ../upload
npm update
cd ../list-pdfs
npm update
cd ../..

# Redeploy
./scripts/deploy-all.sh
```

---

## Rollback

### Rollback Lambda Function

AWS Lambda keeps previous versions:

```bash
# List versions
aws lambda list-versions-by-function --function-name pdf-auth

# Rollback to previous version
aws lambda update-alias \
  --function-name pdf-auth \
  --name PROD \
  --function-version 2  # Previous version number
```

### Rollback Frontend

```bash
# If you have backup:
aws s3 sync backup-folder/ s3://your-bucket-static/

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### Git-based Rollback

```bash
# Revert to previous commit
git log --oneline  # Find commit hash
git revert <commit-hash>

# Rebuild and redeploy
./scripts/deploy-all.sh
```

---

## Deployment Workflows

### Development Workflow

```bash
# 1. Make changes
vim lambda/auth/index.ts

# 2. Build
cd lambda/auth
npm run build

# 3. Test locally (optional)
npm test

# 4. Deploy
cd ../..
./scripts/deploy-lambdas.sh

# 5. Verify in browser
```

### CI/CD Workflow (GitHub Actions)

Example `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Build
        run: ./scripts/build-all.sh
      
      - name: Deploy
        run: ./scripts/deploy-all.sh
```

---

## Troubleshooting Deployment

### Build Fails

```bash
# Check Node.js version
node --version  # Should be 18+

# Clear node_modules and reinstall
rm -rf frontend/node_modules
rm -rf lambda/*/node_modules
./scripts/build-all.sh
```

### Lambda Deployment Fails

```bash
# Check AWS credentials
aws sts get-caller-identity

# Verify Lambda function exists
aws lambda get-function --function-name pdf-auth

# Check IAM permissions
# Ensure your user has lambda:UpdateFunctionCode permission
```

### Frontend Deployment Fails

```bash
# Check S3 bucket exists
aws s3 ls s3://your-bucket-static/

# Check S3 permissions
# Ensure you have s3:PutObject permission

# Try manual upload
aws s3 cp frontend/public/index.html s3://your-bucket-static/
```

### CloudFront Not Updating

```bash
# Check invalidation status
aws cloudfront list-invalidations --distribution-id E1234567890ABC

# Create new invalidation
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"

# Wait 5-10 minutes for invalidation to complete
```

---

## Best Practices

1. **Always build before deploying**: Run `./scripts/build-all.sh` first
2. **Test locally when possible**: Use `npm run dev` for frontend
3. **Check CloudWatch logs**: Monitor Lambda execution after deployment
4. **Use environment-specific .env files**: `.env.dev`, `.env.prod`
5. **Version your deployments**: Tag releases in Git
6. **Backup before major changes**: Download S3 contents, export Lambda code
7. **Invalidate CloudFront cache**: Always invalidate after frontend changes
8. **Monitor costs**: Check AWS billing dashboard regularly

---

## Deployment Checklist

Before deploying to production:

- [ ] All code changes committed to Git
- [ ] `.env` file has correct values
- [ ] Password hash generated and set
- [ ] Frontend builds without errors
- [ ] All Lambda functions build without errors
- [ ] AWS credentials configured
- [ ] All AWS infrastructure exists (S3, Lambda, API Gateway, CloudFront)
- [ ] Tested locally (if possible)
- [ ] Backup of current deployment (if updating)

---

## Additional Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS CLI Reference](https://docs.aws.amazon.com/cli/)
- [CloudFront Invalidation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)
- [Main README](./README.md)
- [AWS Setup Guide](./AWS_SETUP.md)
