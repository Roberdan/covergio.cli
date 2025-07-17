#!/bin/bash

# Convergio CLI - Authentication Setup Script
# Configures API keys for AI providers

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

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Display banner
echo -e "${BLUE}"
cat << "EOF"
   ____                               _       
  / ___|___  _ ____   _____ _ __ __ _(_) ___  
 | |   / _ \| '_ \ \ / / _ \ '__/ _` | |/ _ \ 
 | |__| (_) | | | \ V /  __/ | | (_| | | (_) |
  \____\___/|_| |_|\_/ \___|_|  \__, |_|\___/ 
                                |___/        
EOF
echo -e "${NC}"
echo -e "${GREEN}Convergio CLI - Authentication Setup${NC}"
echo -e "${YELLOW}Configure API Keys for AI Providers${NC}"
echo ""

# Create .gemini directory
GEMINI_DIR=".gemini"
ENV_FILE="$GEMINI_DIR/.env"

if [ ! -d "$GEMINI_DIR" ]; then
    print_step "Creating $GEMINI_DIR directory..."
    mkdir -p "$GEMINI_DIR"
fi

# Check if .env file exists
if [ -f "$ENV_FILE" ]; then
    print_warning "Environment file already exists: $ENV_FILE"
    echo ""
    read -p "Do you want to:" $'\n'"1) Add new keys (append)" $'\n'"2) Replace existing file" $'\n'"3) View current keys" $'\n'"4) Cancel" $'\n'"Enter choice (1-4): " choice
    
    case $choice in
        1)
            print_info "Appending new keys to existing file..."
            ;;
        2)
            print_warning "This will overwrite the existing file!"
            read -p "Are you sure? (y/N): " confirm
            if [[ "$confirm" =~ ^[Yy]$ ]]; then
                > "$ENV_FILE"  # Clear file
                print_info "File cleared. Adding new keys..."
            else
                print_info "Cancelled."
                exit 0
            fi
            ;;
        3)
            print_info "Current environment variables:"
            echo ""
            cat "$ENV_FILE" | grep -E "^[A-Z_]+" | sed 's/=.*/=***/' || echo "No keys found."
            echo ""
            exit 0
            ;;
        4)
            print_info "Setup cancelled."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Cancelled."
            exit 1
            ;;
    esac
    echo ""
fi

# Function to add API key
add_api_key() {
    local provider="$1"
    local env_var="$2"
    local description="$3"
    local url="$4"
    
    echo -e "${CYAN}=== $provider Setup ===${NC}"
    echo "$description"
    if [ -n "$url" ]; then
        echo "Get your API key from: $url"
    fi
    echo ""
    
    read -p "Do you want to configure $provider? (y/N): " configure
    if [[ "$configure" =~ ^[Yy]$ ]]; then
        read -s -p "Enter your $provider API key: " api_key
        echo ""
        
        if [ -n "$api_key" ]; then
            # Check if key already exists in file
            if grep -q "^$env_var=" "$ENV_FILE" 2>/dev/null; then
                # Replace existing key
                if [[ "$(uname)" == "Darwin" ]]; then
                    # macOS sed
                    sed -i '' "s/^$env_var=.*/$env_var=\"$api_key\"/" "$ENV_FILE"
                else
                    # Linux sed
                    sed -i "s/^$env_var=.*/$env_var=\"$api_key\"/" "$ENV_FILE"
                fi
                print_success "$provider API key updated!"
            else
                # Add new key
                echo "$env_var=\"$api_key\"" >> "$ENV_FILE"
                print_success "$provider API key added!"
            fi
        else
            print_warning "No API key entered for $provider. Skipping..."
        fi
    else
        print_info "Skipping $provider configuration."
    fi
    echo ""
}

# Main configuration menu
echo "Select providers to configure:"
echo ""
echo "Primary Providers (Recommended):"
echo "1) Gemini (Google AI Studio) - Primary provider for Convergio"
echo "2) Anthropic Claude - Advanced reasoning and code"
echo "3) OpenAI GPT - General purpose and coding"
echo ""
echo "Additional Providers:"
echo "4) Google Vertex AI - Enterprise Google AI"
echo "5) Perplexity - Research and web search"
echo "6) Mistral AI - European AI provider"
echo "7) Configure all providers"
echo "8) Custom configuration"
echo ""

read -p "Enter your choice (1-8): " provider_choice

case $provider_choice in
    1)
        add_api_key "Google Gemini" "GEMINI_API_KEY" "Primary AI provider for Convergio CLI." "https://aistudio.google.com/app/apikey"
        ;;
    2)
        add_api_key "Anthropic Claude" "ANTHROPIC_API_KEY" "Advanced reasoning and coding assistance." "https://console.anthropic.com/"
        ;;
    3)
        add_api_key "OpenAI GPT" "OPENAI_API_KEY" "General purpose AI and coding assistance." "https://platform.openai.com/api-keys"
        ;;
    4)
        add_api_key "Google Vertex AI" "GOOGLE_API_KEY" "Enterprise Google AI platform." "https://cloud.google.com/vertex-ai/generative-ai/docs/start/api-keys"
        print_info "For Vertex AI, you may also need:"
        read -p "Google Cloud Project ID (optional): " project_id
        if [ -n "$project_id" ]; then
            echo "GOOGLE_CLOUD_PROJECT=\"$project_id\"" >> "$ENV_FILE"
            print_success "Google Cloud Project ID added!"
        fi
        ;;
    5)
        add_api_key "Perplexity AI" "PERPLEXITY_API_KEY" "Research and web search capabilities." "https://www.perplexity.ai/settings/api"
        ;;
    6)
        add_api_key "Mistral AI" "MISTRAL_API_KEY" "European AI provider for diverse perspectives." "https://console.mistral.ai/"
        ;;
    7)
        print_info "Configuring all providers..."
        add_api_key "Google Gemini" "GEMINI_API_KEY" "Primary AI provider for Convergio CLI." "https://aistudio.google.com/app/apikey"
        add_api_key "Anthropic Claude" "ANTHROPIC_API_KEY" "Advanced reasoning and coding assistance." "https://console.anthropic.com/"
        add_api_key "OpenAI GPT" "OPENAI_API_KEY" "General purpose AI and coding assistance." "https://platform.openai.com/api-keys"
        add_api_key "Perplexity AI" "PERPLEXITY_API_KEY" "Research and web search capabilities." "https://www.perplexity.ai/settings/api"
        ;;
    8)
        print_info "Custom configuration mode..."
        while true; do
            read -p "Environment variable name (or 'done' to finish): " var_name
            if [ "$var_name" = "done" ]; then
                break
            fi
            read -s -p "Value for $var_name: " var_value
            echo ""
            if [ -n "$var_value" ]; then
                echo "$var_name=\"$var_value\"" >> "$ENV_FILE"
                print_success "$var_name added!"
            fi
        done
        ;;
    *)
        print_error "Invalid choice. Setup cancelled."
        exit 1
        ;;
esac

# Verify setup
echo ""
print_step "Verifying setup..."

if [ -f "$ENV_FILE" ] && [ -s "$ENV_FILE" ]; then
    print_success "Authentication setup complete!"
    print_info "Configuration saved to: $ENV_FILE"
    echo ""
    print_info "Current configured providers:"
    grep -E "^[A-Z_]+" "$ENV_FILE" | sed 's/=.*//' | sed 's/^/  - /' || echo "  No keys found."
    echo ""
    print_info "Test your setup with:"
    echo "  ./convergio.sh --help"
    echo "  ./convergio.sh -p \"Hello, test my setup\""
    echo ""
    print_warning "Keep your API keys secure and never commit them to version control!"
else
    print_warning "No API keys were configured."
    print_info "You can run this script again anytime to configure authentication."
fi

echo ""
print_info "For more authentication options, see: docs/cli/authentication.md"