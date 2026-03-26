# Migration to AWS Secrets Manager - Summary

## Changes Made

### 1. New Files Created

#### `lambda/shared/secrets.ts`
- New module to handle Secrets Manager integration
- Fetches secrets from AWS Secrets Manager
- Caches secrets for Lambda execution environment lifetime
- Retrieves both `passwordHash` and `jwtSecret`

#### `scripts/create-secrets.sh`
- Helper script to create/update secrets in AWS Secrets Manager
- Usage: `./scripts/create-secrets.sh '<password-hash>' '<jwt-secret>'`

#### `SECRETS_SETUP.md`
- Complete documentation for setting up and using Secrets Manager
- Includes setup steps, IAM permissions, troubleshooting, and best practices

#### `iam-policy-secrets.json`
- IAM policy JSON for granting Secrets Manager access
- Attach to Lambda execution roles

### 2. Modified Files

#### `lambda/auth/index.ts`
- Removed `PASSWORD_HASH` environment variable reference
- Added import for `getSecrets()` from shared/secrets
- Updated to fetch password hash from Secrets Manager
- Updated to use async `generateToken()`

#### `lambda/shared/auth.ts`
- Converted `generateToken()` to async function
- Converted `verifyToken()` to async function
- Both functions now retrieve JWT secret from Secrets Manager
- Removed `JWT_SECRET` environment variable reference

#### `lambda/list-pdfs/index.ts`
- Updated to use async `verifyToken()`
- Better error handling for missing vs invalid tokens

#### `lambda/auth/package.json`
- Added dependency: `@aws-sdk/client-secrets-manager": "^3.490.0"`

#### `lambda/list-pdfs/package.json`
- Added dependency: `@aws-sdk/client-secrets-manager": "^3.490.0"`

## Migration Steps

### 1. Generate Your Secrets

```bash
# Generate password hash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-password', 10));"

# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
```

### 2. Create Secret in AWS

```bash
chmod +x scripts/create-secrets.sh
./scripts/create-secrets.sh '<password-hash>' '<jwt-secret>'
```

### 3. Update IAM Roles

Attach the policy in `iam-policy-secrets.json` to your Lambda execution roles:

```bash
# Get the role name
aws lambda get-function-configuration --function-name pdf-directory-auth --query 'Role'

# Attach inline policy
aws iam put-role-policy \
    --role-name <your-lambda-role-name> \
    --policy-name SecretsManagerAccess \
    --policy-document file://iam-policy-secrets.json
```

### 4. Deploy Updated Lambda Functions

```bash
# Auth Lambda
cd lambda/auth
npm install
npm run package
aws lambda update-function-code \
    --function-name pdf-directory-auth \
    --zip-file fileb://function.zip

# Update environment variable
aws lambda update-function-configuration \
    --function-name pdf-directory-auth \
    --environment Variables='{
        "ALLOWED_ORIGINS":"your-cloudfront-url",
        "SECRET_NAME":"pdf-directory-secrets"
    }'

# List PDFs Lambda
cd ../list-pdfs
npm install
npm run package
aws lambda update-function-code \
    --function-name pdf-directory-list \
    --zip-file fileb://function.zip

# Update environment variable
aws lambda update-function-configuration \
    --function-name pdf-directory-list \
    --environment Variables='{
        "PDF_BUCKET_NAME":"your-pdf-bucket",
        "ALLOWED_ORIGINS":"your-cloudfront-url",
        "PRESIGNED_URL_EXPIRY":"3600",
        "SECRET_NAME":"pdf-directory-secrets"
    }'
```

### 5. Remove Old Environment Variables

The following environment variables are no longer needed:
- `PASSWORD_HASH` (from auth Lambda)
- `JWT_SECRET` (from both Lambdas, if set)

They're now retrieved from Secrets Manager.

## Benefits

1. **Single Source of Truth**: Update secrets in one place instead of multiple Lambda environment variables
2. **Better Security**: Secrets are encrypted at rest and in transit
3. **Audit Trail**: CloudTrail logs all secret access
4. **Easy Rotation**: Update secrets without redeploying Lambda functions
5. **Access Control**: Fine-grained IAM permissions

## Environment Variables

### Before (per Lambda)
- Auth Lambda: `PASSWORD_HASH`, `JWT_SECRET`, `ALLOWED_ORIGINS`
- List Lambda: `JWT_SECRET`, `PDF_BUCKET_NAME`, `ALLOWED_ORIGINS`, `PRESIGNED_URL_EXPIRY`

### After (per Lambda)
- Auth Lambda: `SECRET_NAME`, `ALLOWED_ORIGINS`
- List Lambda: `SECRET_NAME`, `PDF_BUCKET_NAME`, `ALLOWED_ORIGINS`, `PRESIGNED_URL_EXPIRY`

## Cost Impact

AWS Secrets Manager costs approximately $0.40-0.50/month:
- $0.40 per secret per month
- $0.05 per 10,000 API calls (minimal due to caching)

## Rollback Plan

If needed, you can revert by:
1. Setting `PASSWORD_HASH` and `JWT_SECRET` environment variables
2. Reverting the code changes in git
3. Redeploying the Lambda functions

## Testing

After deployment, test:
1. Login to your PDF directory website
2. Verify JWT token is generated
3. Verify you can access protected PDF listings
4. Check CloudWatch logs for any errors

## Next Steps

Consider setting up secret rotation:
- Create a Lambda function to rotate secrets
- Set up AWS Secrets Manager rotation schedule
- Update application to handle graceful rotation (overlapping validity periods)
