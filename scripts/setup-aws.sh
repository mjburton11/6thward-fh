#!/bin/bash

# AWS Setup Script - One-time infrastructure setup
# Usage: ./scripts/setup-aws.sh
# 
# Note: This script provides basic automation.
# For complete manual setup, see AWS_SETUP.md

set -e  # Exit on error

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "========================================="
echo "AWS Infrastructure Setup"
echo "========================================="
echo ""
echo "⚠️  IMPORTANT: This script performs basic setup."
echo "For complete manual setup instructions, see AWS_SETUP.md"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check AWS credentials
echo -e "${BLUE}Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo -e "${RED}AWS credentials not configured. Run 'aws configure' first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials verified${NC}"

# Check if required env vars are set
if [ -z "$STATIC_BUCKET_NAME" ] || [ -z "$PDF_BUCKET_NAME" ]; then
    echo -e "${RED}Please set bucket names in .env file first${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}This script will create:${NC}"
echo "  - S3 bucket: ${STATIC_BUCKET_NAME}"
echo "  - S3 bucket: ${PDF_BUCKET_NAME}"
echo "  - Lambda functions (if function names are set)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Create S3 buckets
echo ""
echo -e "${BLUE}Creating S3 buckets...${NC}"

# Create static bucket
if aws s3 ls "s3://${STATIC_BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3 mb "s3://${STATIC_BUCKET_NAME}" --region "$AWS_REGION"
    echo -e "${GREEN}✓ Created bucket: ${STATIC_BUCKET_NAME}${NC}"
else
    echo -e "${YELLOW}⚠ Bucket ${STATIC_BUCKET_NAME} already exists${NC}"
fi

# Enable static website hosting
aws s3 website "s3://${STATIC_BUCKET_NAME}" \
    --index-document index.html \
    --error-document index.html

echo -e "${GREEN}✓ Enabled static website hosting${NC}"

# Create PDFs bucket
if aws s3 ls "s3://${PDF_BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3 mb "s3://${PDF_BUCKET_NAME}" --region "$AWS_REGION"
    echo -e "${GREEN}✓ Created bucket: ${PDF_BUCKET_NAME}${NC}"
else
    echo -e "${YELLOW}⚠ Bucket ${PDF_BUCKET_NAME} already exists${NC}"
fi

# Set public access for PDFs bucket
echo -e "${BLUE}Configuring public access for PDFs bucket...${NC}"
aws s3api put-public-access-block \
    --bucket "$PDF_BUCKET_NAME" \
    --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"

# Create bucket policy for public read
cat > /tmp/pdf-bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${PDF_BUCKET_NAME}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
    --bucket "$PDF_BUCKET_NAME" \
    --policy file:///tmp/pdf-bucket-policy.json

rm /tmp/pdf-bucket-policy.json
echo -e "${GREEN}✓ PDFs bucket configured for public access${NC}"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Basic infrastructure setup complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${YELLOW}NEXT STEPS:${NC}"
echo ""
echo "1. Create Lambda functions manually or via AWS Console"
echo "   - Function names: ${AUTH_LAMBDA_NAME}, ${UPLOAD_LAMBDA_NAME}, ${LIST_LAMBDA_NAME}"
echo "   - Runtime: Node.js 18.x"
echo "   - See AWS_SETUP.md for detailed instructions"
echo ""
echo "2. Create API Gateway REST API"
echo "   - Create endpoints: /api/auth (POST), /api/pdfs (GET), /api/upload (POST)"
echo "   - Connect to Lambda functions"
echo "   - Enable CORS"
echo "   - See AWS_SETUP.md section 5"
echo ""
echo "3. Create CloudFront distribution"
echo "   - Origin 1: ${STATIC_BUCKET_NAME} (static files)"
echo "   - Origin 2: ${PDF_BUCKET_NAME} (PDFs)"
echo "   - Origin 3: API Gateway"
echo "   - See AWS_SETUP.md section 6"
echo ""
echo "4. Update .env file with:"
echo "   - API Gateway URL"
echo "   - CloudFront Distribution ID"
echo "   - CloudFront Domain"
echo ""
echo "5. Generate password hash:"
echo "   node -e \"console.log(require('bcryptjs').hashSync('YourPassword', 10))\""
echo "   Add to .env as PASSWORD_HASH"
echo ""
echo "6. Build and deploy:"
echo "   ./scripts/build-all.sh"
echo "   ./scripts/deploy-all.sh"
echo ""
echo -e "${BLUE}For complete setup instructions, see AWS_SETUP.md${NC}"
