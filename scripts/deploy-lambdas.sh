#!/bin/bash

# Deploy Lambda Functions Script
# Usage: ./scripts/deploy-lambdas.sh

set -e  # Exit on error

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

echo "========================================="
echo "Deploying Lambda Functions"
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
if [ -z "$AUTH_LAMBDA_NAME" ] || [ -z "$UPLOAD_LAMBDA_NAME" ] || [ -z "$LIST_LAMBDA_NAME" ]; then
    echo -e "${YELLOW}Please set Lambda function names in .env file${NC}"
    exit 1
fi

# Function to package and deploy Lambda
deploy_lambda() {
    local LAMBDA_DIR=$1
    local LAMBDA_NAME=$2
    
    echo -e "${BLUE}Deploying ${LAMBDA_NAME}...${NC}"
    
    cd "lambda/${LAMBDA_DIR}"
    
    # Create deployment package
    if [ -d "dist" ]; then
        cd dist
        
        # Copy shared modules
        mkdir -p shared
        cp ../../shared/*.js shared/ 2>/dev/null || true
        
        # Install production dependencies
        npm install --production --silent
        
        # Create zip file
        zip -r -q ../function.zip .
        cd ..
        
        # Deploy to AWS
        aws lambda update-function-code \
            --function-name "$LAMBDA_NAME" \
            --zip-file fileb://function.zip \
            --region "$AWS_REGION" \
            --profile "$AWS_PROFILE" \
            > /dev/null
        
        # Update environment variables if they exist
        if [ ! -z "$JWT_SECRET" ]; then
            ENV_VARS="JWT_SECRET=$JWT_SECRET"
            
            if [ "$LAMBDA_NAME" == "$AUTH_LAMBDA_NAME" ] && [ ! -z "$PASSWORD_HASH" ]; then
                ENV_VARS="$ENV_VARS,PASSWORD_HASH=$PASSWORD_HASH,ALLOWED_ORIGINS=*"
            elif [ "$LAMBDA_NAME" == "$UPLOAD_LAMBDA_NAME" ] || [ "$LAMBDA_NAME" == "$LIST_LAMBDA_NAME" ]; then
                ENV_VARS="$ENV_VARS,PDF_BUCKET_NAME=$PDF_BUCKET_NAME"
                if [ ! -z "$CLOUDFRONT_DOMAIN" ]; then
                    ENV_VARS="$ENV_VARS,CLOUDFRONT_DOMAIN=$CLOUDFRONT_DOMAIN"
                fi
            fi
            
            aws lambda update-function-configuration \
                --function-name "$LAMBDA_NAME" \
                --environment "Variables={$ENV_VARS}" \
                --region "$AWS_REGION" \
                --profile "$AWS_PROFILE" \
                > /dev/null
        fi
        
        # Clean up
        rm function.zip
        
        echo -e "${GREEN}✓ ${LAMBDA_NAME} deployed successfully${NC}"
    else
        echo -e "${YELLOW}⚠ dist/ folder not found for ${LAMBDA_NAME}. Run build-all.sh first.${NC}"
        cd ../..
        return 1
    fi
    
    cd ../..
}

# Deploy all Lambda functions
deploy_lambda "auth" "$AUTH_LAMBDA_NAME"
deploy_lambda "upload" "$UPLOAD_LAMBDA_NAME"
deploy_lambda "list-pdfs" "$LIST_LAMBDA_NAME"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All Lambda functions deployed!${NC}"
echo -e "${GREEN}=========================================${NC}"
