#!/bin/bash

# Deploy Frontend Script
# Usage: ./scripts/deploy-frontend.sh

set -e  # Exit on error

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "========================================="
echo "Deploying Frontend to S3"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

# Check if required env vars are set
if [ -z "$STATIC_BUCKET_NAME" ]; then
    echo -e "${YELLOW}Please set STATIC_BUCKET_NAME in .env file${NC}"
    exit 1
fi

# Build frontend if not already built
if [ ! -d "frontend/dist" ]; then
    echo -e "${BLUE}Frontend not built. Building now...${NC}"
    cd frontend
    npm install
    npm run build
    cd ..
fi

# Sync public folder (HTML and CSS)
echo -e "${BLUE}Uploading HTML and CSS files...${NC}"
aws s3 sync frontend/public/ "s3://${STATIC_BUCKET_NAME}/" \
    --exclude "*.DS_Store" \
    --cache-control "public, max-age=3600" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE"

echo -e "${GREEN}✓ Static files uploaded${NC}"

# Sync dist folder (compiled JS)
echo -e "${BLUE}Uploading JavaScript files...${NC}"
aws s3 sync frontend/dist/ "s3://${STATIC_BUCKET_NAME}/dist/" \
    --exclude "*.DS_Store" \
    --cache-control "public, max-age=31536000" \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE"

echo -e "${GREEN}✓ JavaScript files uploaded${NC}"

# Invalidate CloudFront cache if CLOUDFRONT_ID is set
if [ ! -z "$CLOUDFRONT_ID" ]; then
    echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_ID" \
        --paths "/*" \
        --region "$AWS_REGION" \
        --profile "$AWS_PROFILE" \
        > /dev/null
    echo -e "${GREEN}✓ CloudFront cache invalidated${NC}"
fi

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Frontend deployed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"

if [ ! -z "$CLOUDFRONT_DOMAIN" ]; then
    echo -e "${BLUE}Your site is available at:${NC}"
    echo -e "https://${CLOUDFRONT_DOMAIN}"
fi
