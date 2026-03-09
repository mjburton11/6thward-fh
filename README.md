# PDF Directory Website

A serverless AWS-based PDF directory website with password-protected access and public PDF sharing.

## Features

- 🔒 Password-protected directory access
- 📄 Upload PDFs via web interface
- 🌐 Public PDF URLs (shareable)
- ⚡ Serverless architecture (AWS Lambda + S3 + CloudFront)
- 🎨 Modern, responsive UI with htmx
- 🔐 JWT-based authentication
- 📦 TypeScript throughout (Lambda functions and frontend)

## Architecture

- **Frontend**: Static HTML/CSS + TypeScript (compiled with Vite) + htmx
- **Backend**: AWS Lambda functions (TypeScript)
- **Storage**: S3 (static files + PDFs)
- **CDN**: CloudFront
- **API**: API Gateway
- **Authentication**: JWT tokens

## Project Structure

```
pdf-directory-website/
├── frontend/               # Frontend application
│   ├── src/               # TypeScript source
│   ├── public/            # HTML and CSS
│   └── dist/              # Compiled output
├── lambda/                # Lambda functions
│   ├── shared/           # Shared utilities
│   ├── auth/             # Authentication
│   ├── upload/           # PDF upload
│   └── list-pdfs/        # List PDFs
├── scripts/              # Deployment scripts
├── AWS_SETUP.md          # Complete AWS setup guide
└── DEPLOY.md             # Deployment guide
```

## Prerequisites

- Node.js 18+ and npm
- AWS CLI configured (`aws configure`)
- AWS account with appropriate permissions
- Git

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/pdf-directory-website.git
cd pdf-directory-website

# Copy environment template
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` and set your values:

```bash
AWS_REGION=us-east-1
AWS_PROFILE=default
STATIC_BUCKET_NAME=your-unique-static-bucket
PDF_BUCKET_NAME=your-unique-pdfs-bucket
# ... add other values after AWS setup
```

### 3. AWS Infrastructure Setup

See [AWS_SETUP.md](./AWS_SETUP.md) for complete step-by-step instructions.

**Quick setup (creates S3 buckets):**

```bash
./scripts/setup-aws.sh
```

**Then manually create:**
- Lambda functions
- API Gateway
- CloudFront distribution

(See AWS_SETUP.md for detailed instructions)

### 4. Generate Password Hash

```bash
node -e "console.log(require('bcryptjs').hashSync('YourPassword', 10))"
```

Add the hash to `.env` as `PASSWORD_HASH`.

### 5. Build and Deploy

```bash
# Build everything
./scripts/build-all.sh

# Deploy Lambda functions
./scripts/deploy-lambdas.sh

# Deploy frontend
./scripts/deploy-frontend.sh

# Or deploy everything at once
./scripts/deploy-all.sh
```

## Development

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:3000`

### Build Frontend

```bash
cd frontend
npm run build
```

### Build Lambda Functions

```bash
cd lambda/auth    # or upload, list-pdfs
npm install
npm run build
```

## Deployment

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

### Quick Deploy

```bash
./scripts/deploy-all.sh
```

### Deploy Components Individually

```bash
# Deploy only Lambda functions
./scripts/deploy-lambdas.sh

# Deploy only frontend
./scripts/deploy-frontend.sh
```

## Usage

1. Visit your CloudFront URL
2. Enter password on login page
3. Upload PDFs from the directory page
4. Share PDF URLs publicly (e.g., `https://your-domain.cloudfront.net/filename.pdf`)

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_REGION` | AWS region | `us-east-1` |
| `AWS_PROFILE` | AWS CLI profile | `default` |
| `STATIC_BUCKET_NAME` | S3 bucket for static files | `mysite-static` |
| `PDF_BUCKET_NAME` | S3 bucket for PDFs | `mysite-pdfs` |
| `CLOUDFRONT_ID` | CloudFront distribution ID | `E1234567890ABC` |
| `CLOUDFRONT_DOMAIN` | CloudFront domain | `d123456.cloudfront.net` |
| `API_GATEWAY_URL` | API Gateway URL | `https://xyz.execute-api.us-east-1.amazonaws.com/prod` |
| `JWT_SECRET` | Secret for JWT signing | `your-secret-key` |
| `PASSWORD_HASH` | Bcrypt hash of password | `$2b$10$...` |

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/setup-aws.sh` | One-time AWS infrastructure setup |
| `scripts/build-all.sh` | Build frontend and all Lambda functions |
| `scripts/deploy-lambdas.sh` | Deploy Lambda functions to AWS |
| `scripts/deploy-frontend.sh` | Upload frontend to S3 |
| `scripts/deploy-all.sh` | Build and deploy everything |

## Tech Stack

- **Frontend**: TypeScript, htmx, Vite, CSS
- **Backend**: TypeScript, Node.js 18+
- **AWS Services**: Lambda, S3, CloudFront, API Gateway
- **Authentication**: JWT, bcrypt
- **Build Tools**: TypeScript, Vite, npm

## Security

- Password hashed with bcrypt
- JWT tokens for session management
- CORS configured for API endpoints
- Public access only for PDF files
- HTTPS enforced via CloudFront

## Cost Estimate

With AWS Free Tier:
- S3: Free for 5GB storage, 20,000 GET requests
- Lambda: Free for 1M requests/month
- API Gateway: Free for 1M requests/month
- CloudFront: Free for 1TB data transfer/month

Typical monthly cost (beyond free tier): $1-5 for light usage

## Troubleshooting

See [AWS_SETUP.md](./AWS_SETUP.md) section 9 for common issues and solutions.

## Documentation

- [AWS_SETUP.md](./AWS_SETUP.md) - Complete AWS infrastructure setup guide
- [DEPLOY.md](./DEPLOY.md) - Deployment guide and workflows

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## GitHub Setup

```bash
# Initialize Git
git init

# Create .gitignore (already included)

# Commit
git add .
git commit -m "Initial commit: PDF directory website"

# Add remote (create repo on GitHub first)
git remote add origin https://github.com/YOUR_USERNAME/pdf-directory-website.git

# Push
git branch -M main
git push -u origin main
```
