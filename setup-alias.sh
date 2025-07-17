#!/bin/bash

# Convergio CLI - Alias Setup Script
# Creates shell aliases for easy access

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_SCRIPT="$SCRIPT_DIR/convergio.sh"

echo -e "${BLUE}Convergio CLI - Alias Setup${NC}"
echo ""

# Check if launcher exists
if [ ! -f "$LAUNCHER_SCRIPT" ]; then
    print_error "Launcher script not found at: $LAUNCHER_SCRIPT"
    exit 1
fi

# Detect shell
SHELL_NAME=$(basename "$SHELL")
case "$SHELL_NAME" in
    "bash")
        SHELL_RC="$HOME/.bashrc"
        ;;
    "zsh")
        SHELL_RC="$HOME/.zshrc"
        ;;
    "fish")
        SHELL_RC="$HOME/.config/fish/config.fish"
        print_warning "Fish shell detected. Manual setup may be required."
        ;;
    *)
        print_warning "Unknown shell: $SHELL_NAME. Using .bashrc as fallback."
        SHELL_RC="$HOME/.bashrc"
        ;;
esac

print_info "Detected shell: $SHELL_NAME"
print_info "RC file: $SHELL_RC"

# Create alias
ALIAS_LINE="alias convergio='$LAUNCHER_SCRIPT'"

# Check if alias already exists
if [ -f "$SHELL_RC" ] && grep -q "alias convergio=" "$SHELL_RC"; then
    print_warning "Convergio alias already exists in $SHELL_RC"
    read -p "Do you want to replace it? (y/N): " replace
    if [[ "$replace" =~ ^[Yy]$ ]]; then
        # Remove existing alias
        if [[ "$SHELL_NAME" == "Darwin" ]] || [[ "$(uname)" == "Darwin" ]]; then
            # macOS sed
            sed -i '' '/alias convergio=/d' "$SHELL_RC"
        else
            # Linux sed
            sed -i '/alias convergio=/d' "$SHELL_RC"
        fi
        print_info "Removed existing alias."
    else
        print_info "Keeping existing alias."
        exit 0
    fi
fi

# Add new alias
echo "" >> "$SHELL_RC"
echo "# Convergio CLI alias" >> "$SHELL_RC"
echo "$ALIAS_LINE" >> "$SHELL_RC"

print_success "Alias added to $SHELL_RC"
print_info "Reload your shell or run: source $SHELL_RC"
print_info "Then you can run: convergio [options...]"

echo ""
print_info "Available commands after reload:"
echo "  convergio                    # Start interactive mode"
echo "  convergio --help            # Show help"
echo "  convergio -p \"your prompt\"  # Execute prompt directly"
echo "  convergio --list-extensions # List extensions"