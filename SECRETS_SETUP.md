# Secrets Manager Setup

This guide explains how to set up AWS Secrets Manager to store your application secrets centrally.

## Overview

The application stores sensitive secrets in AWS Secrets Manager:
- **Password Hash**: bcrypt hash of the admin password
- **JWT Secret**: Secret key used to sign JWT tokens

## Benefits

- **Centralized Management**: Update secrets in one place instead of multiple Lambda environment variables
- **Enhanced Security**: Secrets are encrypted at rest and in transit
- **Access Control**: Fine-grained IAM permissions for secret access
- **Audit Trail**: CloudTrail logs all secret access
- **Rotation Support**: Built-in support for secret rotation

## Setup Steps

### 1. Generate Your Secrets

#### Generate Password Hash

```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-password-here', 10));"
```

Save the output (starts with `$2a$10$...`)

#### Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'));"
```

Save the output (64-character hex string)

### 2. Create the Secret in AWS

Use the provided script:

```bash
chmod +x scripts/create-secrets.sh
./scripts/create-secrets.sh '<password-hash>' '<jwt-secret>'
```

Or create manually using AWS CLI:

```bash
aws secretsmanager create-secret \
    --name pdf-directory-secrets \
    --description "Secrets for PDF Directory application" \
    --secret-string '{
      "passwordHash": "$2a$10$...",
      "jwtSecret": "your-jwt-secret-here"
    }' \
    --region us-east-1
```

### 3. Update IAM Permissions

Add Secrets Manager permissions to your Lambda execution role(s):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:YOUR-ACCOUNT-ID:secret:pdf-directory-secrets-*"
    }
  ]
}
```

### 4. Update Lambda Configuration

#### Set Environment Variable

Add this environment variable to both Lambda functions:
- **Key**: `SECRET_NAME`
- **Value**: `pdf-directory-secrets`

#### Remove Old Environment Variables

Remove these environment variables (no longer needed):
- `PASSWORD_HASH`
- `JWT_SECRET`

### 5. Deploy Updated Lambda Functions

```bash
# Auth Lambda
cd lambda/auth
npm install
npm run package
aws lambda update-function-code \
    --function-name pdf-directory-auth \
    --zip-file fileb://function.zip

# List PDFs Lambda
cd ../list-pdfs
npm install
npm run package
aws lambda update-function-code \
    --function-name pdf-directory-list \
    --zip-file fileb://function.zip
```

## Secret Structure

The secret in Secrets Manager should be stored as JSON:

```json
{
  "passwordHash": "$2a$10$...",
  "jwtSecret": "64-character-hex-string"
}
```

## Caching

The application caches secrets during Lambda execution to minimize API calls:
- Secrets are fetched once per Lambda cold start
- Cached for the lifetime of the Lambda execution environment
- Typically 5-15 minutes, up to several hours

## Updating Secrets

To update secrets:

```bash
./scripts/create-secrets.sh '<new-password-hash>' '<new-jwt-secret>'
```

Or manually:

```bash
aws secretsmanager update-secret \
    --secret-id pdf-directory-secrets \
    --secret-string '{
      "passwordHash": "$2a$10$...",
      "jwtSecret": "new-jwt-secret"
    }' \
    --region us-east-1
```

**Note**: Changes take effect on the next Lambda cold start (5-15 minutes typically).

## Cost

AWS Secrets Manager pricing:
- **Storage**: $0.40 per secret per month
- **API Calls**: $0.05 per 10,000 API calls

With caching, typical costs are ~$0.40-0.50/month for this application.

## Troubleshooting

### Lambda Can't Access Secret

Check:
1. IAM role has `secretsmanager:GetSecretValue` permission
2. Secret name matches `SECRET_NAME` environment variable
3. Secret exists in the same AWS region as Lambda

### Invalid Secret Format

The secret must be valid JSON with both `passwordHash` and `jwtSecret` keys.

### Old Passwords Still Work

Lambda execution environments cache secrets. Wait 15-30 minutes after updating, or force a cold start by updating the Lambda function configuration.

## Security Best Practices

1. **Rotate Secrets Regularly**: Change JWT secret and password periodically
2. **Use Strong JWT Secrets**: At least 32 bytes (256 bits) of randomness
3. **Limit IAM Access**: Only grant Secrets Manager access to Lambda execution roles
4. **Enable CloudTrail**: Monitor secret access in CloudTrail logs
5. **Use Resource Policies**: Consider adding resource policies to secrets for additional access control

## Rollback

If you need to revert to environment variables:

1. Add `PASSWORD_HASH` and `JWT_SECRET` back to Lambda environment variables
2. Update Lambda code to read from `process.env` instead of Secrets Manager
3. Remove Secrets Manager dependencies from `package.json`
