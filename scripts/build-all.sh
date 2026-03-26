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

# Create symlink for shared node_modules (points to auth's node_modules)
# This is needed for TypeScript compilation of shared files
if [ ! -L "lambda/shared/node_modules" ]; then
  echo "Creating node_modules symlink for shared folder..."
  cd lambda/shared
  ln -sf ../auth/node_modules node_modules
  cd ../..
fi

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

# Build delete Lambda
echo "Building delete Lambda..."
cd lambda/delete
npm install
npm run build
cd ../..
echo -e "${GREEN}✓ Delete Lambda built${NC}"

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All builds completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
