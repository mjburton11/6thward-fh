#!/bin/bash

# Deploy All Script - Build and deploy everything
# Usage: ./scripts/deploy-all.sh

set -e  # Exit on error

echo "========================================="
echo "Full Deployment: PDF Directory Website"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1/3: Building...${NC}"
./scripts/build-all.sh

echo ""
echo -e "${BLUE}Step 2/3: Deploying Lambda functions...${NC}"
./scripts/deploy-lambdas.sh

echo ""
echo -e "${BLUE}Step 3/3: Deploying frontend...${NC}"
./scripts/deploy-frontend.sh

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}🎉 Full deployment completed!${NC}"
echo -e "${GREEN}=========================================${NC}"
