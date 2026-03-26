#!/bin/bash

# Script to create or update secrets in AWS Secrets Manager
# Usage: ./scripts/create-secrets.sh <password-hash> <jwt-secret>

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <password-hash> <jwt-secret>"
    echo ""
    echo "Example:"
    echo "  $0 '\$2a\$10\$...' 'your-secret-key-here'"
    echo ""
    echo "To generate a password hash, run:"
    echo "  node -e \"const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-password', 10));\""
    echo ""
    echo "To generate a JWT secret, run:"
    echo "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'));\""
    exit 1
fi

PASSWORD_HASH="$1"
JWT_SECRET="$2"
SECRET_NAME="pdf-directory-secrets"
REGION="${AWS_REGION:-us-east-1}"

echo "Creating/updating secret: $SECRET_NAME in region: $REGION"

# Create the secret JSON
SECRET_JSON=$(cat <<EOF
{
  "passwordHash": "$PASSWORD_HASH",
  "jwtSecret": "$JWT_SECRET"
}
EOF
)

# Try to create the secret first
if aws secretsmanager create-secret \
    --name "$SECRET_NAME" \
    --description "Secrets for PDF Directory application" \
    --secret-string "$SECRET_JSON" \
    --region "$REGION" 2>/dev/null; then
    echo "✓ Secret created successfully!"
else
    # If creation fails (likely because it exists), update it instead
    echo "Secret already exists, updating..."
    aws secretsmanager update-secret \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION"
    echo "✓ Secret updated successfully!"
fi

echo ""
echo "Next steps:"
echo "1. Ensure your Lambda functions have the IAM permission: secretsmanager:GetSecretValue"
echo "2. Set the SECRET_NAME environment variable in your Lambda functions to: $SECRET_NAME"
echo "3. Remove the old PASSWORD_HASH and JWT_SECRET environment variables"
