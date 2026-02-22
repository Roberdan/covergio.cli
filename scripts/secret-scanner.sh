#!/usr/bin/env bash
set -euo pipefail

# Secret scanner — checks staged files for 21 secret patterns.
# Exit 1 if any secrets are found, 0 otherwise.

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  echo "No staged files to scan."
  exit 0
fi

FOUND=0

# 21 secret patterns
PATTERNS=(
  # 1. OpenAI API keys
  'sk-[A-Za-z0-9]{20,}'
  # 2. GitHub personal access tokens
  'ghp_[A-Za-z0-9]{36}'
  # 3. GitHub OAuth tokens
  'gho_[A-Za-z0-9]{36}'
  # 4. GitHub App tokens
  'ghs_[A-Za-z0-9]{36}'
  # 5. AWS Access Key ID
  'AKIA[0-9A-Z]{16}'
  # 6. AWS Temporary Access Key
  'ASIA[0-9A-Z]{16}'
  # 7. Azure Storage Account Key (base64, 88 chars)
  'AccountKey=[A-Za-z0-9+/=]{44,88}'
  # 8. Azure Connection String
  'DefaultEndpointsProtocol=https?;AccountName='
  # 9. GCP API Key
  'AIza[0-9A-Za-z_-]{35}'
  # 10. JWT token
  'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  # 11. Slack Bot Token
  'xoxb-[0-9]{10,}-[0-9]{10,}-[A-Za-z0-9]{24}'
  # 12. Slack User Token
  'xoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[a-z0-9]{32}'
  # 13. Slack Webhook
  'https://hooks\.slack\.com/services/T[A-Z0-9]{8,}/B[A-Z0-9]{8,}/[A-Za-z0-9]{24}'
  # 14. Stripe Secret Key
  'sk_live_[0-9a-zA-Z]{24,}'
  # 15. Stripe Publishable Key
  'pk_live_[0-9a-zA-Z]{24,}'
  # 16. Private Key header
  'BEGIN[[:space:]]+(RSA|DSA|EC|OPENSSH|PGP)[[:space:]]+PRIVATE[[:space:]]+KEY'
  # 17. Generic password in config
  'password[[:space:]]*[:=][[:space:]]*["\x27][^"\x27]{8,}'
  # 18. Generic secret in config
  'secret[[:space:]]*[:=][[:space:]]*["\x27][^"\x27]{8,}'
  # 19. Connection string with credentials
  '(mongodb|postgres|mysql|redis)://[^:]+:[^@]+@'
  # 20. Anthropic API Key
  'sk-ant-[A-Za-z0-9_-]{20,}'
  # 21. Google OAuth Client Secret
  'GOCSPX-[A-Za-z0-9_-]{28}'
)

PATTERN_NAMES=(
  "OpenAI API Key"
  "GitHub Personal Access Token"
  "GitHub OAuth Token"
  "GitHub App Token"
  "AWS Access Key ID"
  "AWS Temporary Access Key"
  "Azure Storage Account Key"
  "Azure Connection String"
  "GCP API Key"
  "JWT Token"
  "Slack Bot Token"
  "Slack User Token"
  "Slack Webhook URL"
  "Stripe Secret Key"
  "Stripe Publishable Key"
  "Private Key"
  "Hardcoded Password"
  "Hardcoded Secret"
  "Connection String with Credentials"
  "Anthropic API Key"
  "Google OAuth Client Secret"
)

for file in $STAGED_FILES; do
  # Skip binary files and lock files
  if [[ "$file" == *.lock ]] || [[ "$file" == *.png ]] || [[ "$file" == *.jpg ]] || [[ "$file" == *.woff* ]]; then
    continue
  fi

  # Skip if file doesn't exist (deleted files)
  if [ ! -f "$file" ]; then
    continue
  fi

  for i in "${!PATTERNS[@]}"; do
    if grep -qEn "${PATTERNS[$i]}" "$file" 2>/dev/null; then
      MATCHES=$(grep -En "${PATTERNS[$i]}" "$file" 2>/dev/null || true)
      while IFS= read -r match; do
        LINE_NUM=$(echo "$match" | cut -d: -f1)
        echo "🚨 ${PATTERN_NAMES[$i]} found in $file:$LINE_NUM"
        FOUND=1
      done <<< "$MATCHES"
    fi
  done
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "❌ Secret scan FAILED — potential secrets detected in staged files."
  echo "   Remove secrets and use environment variables instead."
  exit 1
else
  echo "✅ Secret scan passed — no secrets detected."
  exit 0
fi
