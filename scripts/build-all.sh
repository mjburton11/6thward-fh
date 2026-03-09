#!/bin/bash

# Build All Script - Compiles frontend and all Lambda functions
# Usage: ./scripts/build-all.sh

set -e  # Exit on error

echo "========================================="
echo "Building PDF Directory Website"
echo "========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Build frontend
echo -e "${BLUE}Building frontend...${NC}"
cd frontend
npm install
npm run build
cd ..
echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Build Lambda functions
echo -e "${BLUE}Building Lambda functions...${NC}"

# Build auth Lambda
echo "Building auth Lambda..."
cd lambda/auth
npm install
npm run build
cd ../..
echo -e "${GREEN}✓ Auth Lambda built${NC}"

# Build upload Lambda
echo "Building upload Lambda..."
cd lambda/upload
npm install
npm run build
cd ../..
echo -e "${GREEN}✓ Upload Lambda built${NC}"

# Build list-pdfs Lambda
echo "Building list-pdfs Lambda..."
cd lambda/list-pdfs
npm install
npm run build
cd ../..
echo -e "${GREEN}✓ List PDFs Lambda built${NC}"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All builds completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
