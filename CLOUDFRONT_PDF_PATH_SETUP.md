# Serving PDFs from Custom Domain Path

This guide explains how to serve PDFs from `6thward-fh.theburtonforge.com/pdfs/` using CloudFront behaviors.

## Architecture Overview

- **Main Domain**: `6thward-fh.theburtonforge.com` → Static website (index.html, etc.)
- **PDF Path**: `6thward-fh.theburtonforge.com/pdfs/*` → PDF files from S3 bucket

This is accomplished using CloudFront path-based routing with multiple origins and behaviors.

## Prerequisites

- CloudFront distribution already set up for your static website
- PDF S3 bucket created and configured
- Custom domain configured in CloudFront alternate domain names (CNAMEs)

## Setup Steps

### 1. Add PDF Bucket as Origin in CloudFront

1. Go to **CloudFront** console
2. Select your distribution for `6thward-fh.theburtonforge.com`
3. Go to the **Origins** tab
4. Click **Create origin**

Configure the origin:
- **Origin domain**: Select your PDF S3 bucket (e.g., `6thward-fh-pdfs.s3.us-east-1.amazonaws.com`)
- **Name**: `pdf-bucket` (or any descriptive name)
- **Origin access**: Choose **Origin access control settings (recommended)**
  - Create new OAC or select existing one
  - Name: `pdf-bucket-oac`
- **Enable Origin Shield**: No (unless you have high traffic)
- Click **Create origin**

### 2. Update S3 Bucket Policy

After creating the OAC, CloudFront will show you a policy to add to your S3 bucket. Add this policy to allow CloudFront to access the PDF bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-PDF-BUCKET-NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
        }
      }
    }
  ]
}
```

Apply this to your PDF bucket:

```bash
# Save the policy to a file: pdf-bucket-cloudfront-policy.json
aws s3api put-bucket-policy \
    --bucket YOUR-PDF-BUCKET-NAME \
    --policy file://pdf-bucket-cloudfront-policy.json
```

### 3. Create Behavior for `/pdfs/*` Path

1. Go to the **Behaviors** tab in your CloudFront distribution
2. Click **Create behavior**

Configure the behavior:
- **Path pattern**: `/pdfs/*`
- **Origin**: Select the PDF bucket origin you created
- **Viewer protocol policy**: Redirect HTTP to HTTPS
- **Allowed HTTP methods**: GET, HEAD, OPTIONS
- **Cache policy**: 
  - Use **CachingOptimized** or create custom policy
  - Recommended: Cache based on query strings if using presigned URLs
- **Origin request policy**: None (or create custom if needed)
- **Response headers policy**: 
  - Create or use policy that includes CORS headers
  - Add headers:
    - `Access-Control-Allow-Origin: https://6thward-fh.theburtonforge.com`
    - `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
    - `Access-Control-Allow-Headers: *`
- **Compress objects automatically**: Yes
- Click **Create behavior**

### 4. Adjust Behavior Priority (Important!)

The `/pdfs/*` behavior must be evaluated BEFORE the default behavior:

1. Go to **Behaviors** tab
2. Ensure `/pdfs/*` behavior has a **higher precedence** (lower number) than the default (`Default (*)`) behavior
3. If needed, select the behavior and click **Edit** or drag to reorder

The order should be:
1. `/pdfs/*` → PDF bucket origin
2. `Default (*)` → Static website origin

### 5. Create CORS Configuration for PDF Bucket

Update your PDF bucket CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://6thward-fh.theburtonforge.com"],
    "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Apply via AWS CLI:

```bash
aws s3api put-bucket-cors \
    --bucket YOUR-PDF-BUCKET-NAME \
    --cors-configuration file://cors-pdfs.json
```

### 6. Update Lambda Functions

Already done! Both Lambda functions are updated:
- `lambda/list-pdfs/index.ts` - Returns PDF URLs with `/pdfs/` path
- `lambda/upload/index.ts` - Returns upload confirmation with `/pdfs/` path

### 7. Deploy Updated Lambda Functions

```bash
# List PDFs Lambda
cd lambda/list-pdfs
npm install
npm run package
aws lambda update-function-code \
    --function-name pdf-directory-list \
    --zip-file fileb://function.zip

# Upload Lambda
cd ../upload
npm install
npm run package
aws lambda update-function-code \
    --function-name pdf-directory-upload \
    --zip-file fileb://function.zip
```

### 8. Invalidate CloudFront Cache

After making changes, create an invalidation:

```bash
aws cloudfront create-invalidation \
    --distribution-id YOUR-DISTRIBUTION-ID \
    --paths "/pdfs/*" "/*"
```

## Testing

### 1. Test Direct PDF Access

```bash
curl -I https://6thward-fh.theburtonforge.com/pdfs/test-file.pdf
```

Should return:
- `200 OK` status
- `Content-Type: application/pdf`
- CORS headers

### 2. Test from Website

1. Log in to your website at `https://6thward-fh.theburtonforge.com`
2. PDFs should load with URLs like: `https://6thward-fh.theburtonforge.com/pdfs/filename.pdf`
3. Check browser console for any CORS errors

### 3. Test CORS Preflight

```bash
curl -X OPTIONS https://6thward-fh.theburtonforge.com/pdfs/test-file.pdf \
  -H "Origin: https://6thward-fh.theburtonforge.com" \
  -H "Access-Control-Request-Method: GET" \
  -i
```

Should return CORS headers in response.

## Troubleshooting

### 403 Forbidden Error

- Check S3 bucket policy includes CloudFront OAC
- Verify Origin Access Control is configured correctly
- Ensure S3 bucket is not blocking public access (CloudFront should have access via OAC)

### 404 Not Found

- Verify behavior path pattern is `/pdfs/*` (with trailing `/*`)
- Check behavior precedence order
- Ensure CloudFront origin points to correct S3 bucket

### CORS Errors

- Verify S3 bucket CORS configuration
- Check CloudFront response headers policy includes CORS headers
- Ensure origin in CORS matches exactly: `https://6thward-fh.theburtonforge.com` (no trailing slash)

### PDFs Load Slowly

- Enable CloudFront compression
- Check cache policy is set correctly
- Consider enabling Origin Shield for frequently accessed files

### Mixed Content Warnings

- Ensure all URLs use HTTPS
- Check that `Viewer protocol policy` is set to `Redirect HTTP to HTTPS`

## URL Structure

Your URLs will look like:

- **Website**: `https://6thward-fh.theburtonforge.com/`
- **PDF Files**: `https://6thward-fh.theburtonforge.com/pdfs/filename.pdf`
- **API Gateway**: Keep as separate domain or subdomain

## Cost Considerations

- **CloudFront Data Transfer**: ~$0.085/GB for first 10TB
- **CloudFront Requests**: $0.0075 per 10,000 requests (HTTPS)
- **S3 Storage**: $0.023/GB/month
- No additional cost for multiple origins/behaviors in same distribution

## Security Best Practices

1. **Block public S3 access**: Let only CloudFront access via OAC
2. **Enable CloudFront logging**: Track all requests
3. **Set cache policies**: Reduce origin requests
4. **Use HTTPS only**: Redirect HTTP to HTTPS
5. **Restrict CORS**: Only allow your specific domain

## Advanced: Custom Cache Key

For better caching with presigned URLs or query parameters, create a custom cache policy:

1. Go to **CloudFront** → **Policies** → **Cache**
2. Click **Create cache policy**
3. Configure:
   - **Name**: `PDF-Caching-Policy`
   - **TTL**: Min 1s, Default 86400s (1 day), Max 31536000s (1 year)
   - **Cache key settings**:
     - Include query strings: All (or whitelist specific parameters)
     - Headers: None (or include specific headers if needed)
4. Apply this policy to your `/pdfs/*` behavior

## Rollback

If you need to revert:

1. Delete the `/pdfs/*` behavior
2. Delete the PDF bucket origin
3. Update Lambda functions to use direct S3 URLs or old CloudFront domain
