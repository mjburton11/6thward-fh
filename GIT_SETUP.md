# Git Setup Instructions

The project has been initialized but Git repository creation requires manual setup due to system permissions.

## Initialize Git Repository

```bash
cd /Users/michaelburton/pdf-directory-website

# Initialize Git
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: PDF directory website with TypeScript, htmx, and AWS deployment"
```

## Connect to GitHub

1. Create a new repository on GitHub:
   - Go to https://github.com/new
   - Name: `pdf-directory-website`
   - Description: "Serverless PDF directory with password protection"
   - Keep it **private** (or public if you prefer)
   - Do NOT initialize with README, .gitignore, or license

2. Add remote and push:

```bash
# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/pdf-directory-website.git

# Rename branch to main
git branch -M main

# Push to GitHub
git push -u origin main
```

## Verify

```bash
# Check remote
git remote -v

# Check status
git status
```

Your code is now on GitHub! 🎉
