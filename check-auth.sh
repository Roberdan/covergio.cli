#!/bin/bash

# Convergio CLI - Authentication Checker
# Verifies if API keys are properly configured

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_check() {
    echo -e "${CYAN}[CHECK]${NC} $1"
}

echo -e "${BLUE}Convergio CLI - Authentication Status${NC}"
echo ""

# Check for .env files
ENV_LOCATIONS=(
    ".gemini/.env"
    ".env"
    "$HOME/.gemini/.env"
    "$HOME/.env"
)

found_env_file=""
for env_file in "${ENV_LOCATIONS[@]}"; do
    if [ -f "$env_file" ]; then
        found_env_file="$env_file"
        break
    fi
done

if [ -n "$found_env_file" ]; then
    print_success "Environment file found: $found_env_file"
else
    print_warning "No .env file found in standard locations"
    print_info "Searched locations:"
    for env_file in "${ENV_LOCATIONS[@]}"; do
        echo "  - $env_file"
    done
    echo ""
    print_info "Run './setup-auth.sh' to configure authentication"
    exit 1
fi

echo ""

# Function to check API key
check_api_key() {
    local provider="$1"
    local env_var="$2"
    local required="$3"
    
    # Check if variable is in .env file
    local env_value=""
    if [ -f "$found_env_file" ]; then
        env_value=$(grep "^$env_var=" "$found_env_file" 2>/dev/null | cut -d'=' -f2- | tr -d '"')
    fi
    
    # Check if variable is in environment
    local runtime_value=""
    eval "runtime_value=\$$env_var"
    
    if [ -n "$env_value" ] || [ -n "$runtime_value" ]; then
        local key_source=""
        if [ -n "$runtime_value" ]; then
            key_source="environment variable"
        else
            key_source="$found_env_file"
        fi
        
        print_success "$provider API key configured ($key_source)"
        return 0
    else
        if [ "$required" = "required" ]; then
            print_error "$provider API key missing (required)"
        else
            print_warning "$provider API key not configured (optional)"
        fi
        return 1
    fi
}

# Check primary providers
print_check "Checking primary AI providers..."
primary_configured=0

if check_api_key "Google Gemini" "GEMINI_API_KEY" "recommended"; then
    ((primary_configured++))
fi

if check_api_key "Anthropic Claude" "ANTHROPIC_API_KEY" "optional"; then
    ((primary_configured++))
fi

if check_api_key "OpenAI GPT" "OPENAI_API_KEY" "optional"; then
    ((primary_configured++))
fi

echo ""

# Check additional providers
print_check "Checking additional providers..."

check_api_key "Google Vertex AI" "GOOGLE_API_KEY" "optional"
check_api_key "Perplexity AI" "PERPLEXITY_API_KEY" "optional"
check_api_key "Mistral AI" "MISTRAL_API_KEY" "optional"

# Check Google Cloud configuration
if [ -n "$GOOGLE_CLOUD_PROJECT" ] || grep -q "^GOOGLE_CLOUD_PROJECT=" "$found_env_file" 2>/dev/null; then
    print_success "Google Cloud Project configured"
else
    print_info "Google Cloud Project not configured (only needed for some Google services)"
fi

echo ""

# Summary
print_check "Authentication Summary:"

if [ $primary_configured -eq 0 ]; then
    print_error "No primary AI providers configured!"
    print_warning "Convergio CLI requires at least one AI provider to function."
    echo ""
    print_info "Recommended setup:"
    echo "  1. Run: ./setup-auth.sh"
    echo "  2. Configure at least Google Gemini or Anthropic Claude"
    echo "  3. Test with: ./convergio.sh -p \"test\""
    exit 1
elif [ $primary_configured -eq 1 ]; then
    print_warning "Only one primary provider configured."
    print_info "Consider adding additional providers for redundancy and capabilities."
else
    print_success "Multiple providers configured - excellent setup!"
fi

echo ""

# Test basic CLI functionality
print_check "Testing CLI functionality..."

if [ -f "./convergio.sh" ]; then
    print_success "Convergio launcher found"
    
    # Test help command (should be fast)
    if timeout 5s ./convergio.sh --help >/dev/null 2>&1; then
        print_success "CLI help command works"
    else
        print_warning "CLI help command timeout or error"
    fi
    
    # Test list extensions (should be fast)
    if timeout 5s ./convergio.sh --list-extensions >/dev/null 2>&1; then
        print_success "CLI extensions command works"
    else
        print_warning "CLI extensions command timeout or error"
    fi
else
    print_error "Convergio launcher (./convergio.sh) not found"
    print_info "Run 'npm run build' to create the CLI bundle"
fi

echo ""

# Recommendations
print_info "Next steps:"
if [ $primary_configured -gt 0 ]; then
    echo "  ✅ Authentication is configured"
    echo "  🚀 Test with: ./convergio.sh -p \"Hello, world!\""
    echo "  📖 Interactive mode: ./convergio.sh"
else
    echo "  🔧 Configure authentication: ./setup-auth.sh"
    echo "  📖 Read docs: docs/cli/authentication.md"
fi

echo "  🌐 Install globally: ./install.sh"
echo "  🔍 View configuration: cat $found_env_file"

echo ""
print_info "For troubleshooting, see: docs/troubleshooting.md"