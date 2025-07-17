#!/bin/bash

# Convergio CLI - Installation Script
# Installs the CLI globally for easy access

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
INSTALL_DIR="/usr/local/bin"
LAUNCHER_SCRIPT="$SCRIPT_DIR/convergio.sh"
TARGET_LINK="$INSTALL_DIR/convergio"

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
echo -e "${GREEN}Convergio CLI - Installation Script${NC}"
echo ""

# Check if script is being run as root/sudo
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Installation will be system-wide."
else
    print_info "Running as user. You may need sudo privileges for global installation."
fi

# Check if launcher script exists
if [ ! -f "$LAUNCHER_SCRIPT" ]; then
    print_error "Launcher script not found at: $LAUNCHER_SCRIPT"
    print_info "Make sure you're running this from the Convergio CLI root directory."
    exit 1
fi

# Check if CLI bundle exists
if [ ! -f "$SCRIPT_DIR/bundle/convergio.js" ]; then
    print_error "CLI bundle not found. Please run 'npm run build' first."
    exit 1
fi

# Function to install globally
install_global() {
    print_info "Installing Convergio CLI globally..."
    
    # Create symbolic link
    if [ -L "$TARGET_LINK" ]; then
        print_warning "Existing installation found. Removing..."
        sudo rm "$TARGET_LINK"
    fi
    
    if sudo ln -s "$LAUNCHER_SCRIPT" "$TARGET_LINK"; then
        print_success "Convergio CLI installed globally!"
        print_success "You can now run 'convergio' from anywhere."
    else
        print_error "Failed to create symbolic link. Check permissions."
        exit 1
    fi
}

# Function to install locally
install_local() {
    print_info "Setting up local installation..."
    
    # Create local bin directory if it doesn't exist
    LOCAL_BIN="$HOME/.local/bin"
    mkdir -p "$LOCAL_BIN"
    
    # Create symbolic link
    if [ -L "$LOCAL_BIN/convergio" ]; then
        print_warning "Existing local installation found. Removing..."
        rm "$LOCAL_BIN/convergio"
    fi
    
    if ln -s "$LAUNCHER_SCRIPT" "$LOCAL_BIN/convergio"; then
        print_success "Convergio CLI installed locally!"
        print_success "You can now run 'convergio' from anywhere (if ~/.local/bin is in PATH)."
        
        # Check if ~/.local/bin is in PATH
        if [[ ":$PATH:" != *":$LOCAL_BIN:"* ]]; then
            print_warning "~/.local/bin is not in your PATH."
            print_info "Add the following to your ~/.bashrc or ~/.zshrc:"
            echo ""
            echo "export PATH=\"\$HOME/.local/bin:\$PATH\""
            echo ""
        fi
    else
        print_error "Failed to create symbolic link."
        exit 1
    fi
}

# Show installation options
echo "Choose installation method:"
echo "1) Global installation (requires sudo) - Recommended"
echo "2) Local installation (~/.local/bin)"
echo "3) Cancel"
echo ""

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        install_global
        ;;
    2)
        install_local
        ;;
    3)
        print_info "Installation cancelled."
        exit 0
        ;;
    *)
        print_error "Invalid choice. Installation cancelled."
        exit 1
        ;;
esac

echo ""
print_success "Installation complete!"
print_info "Test the installation with: convergio --help"
print_info "Start interactive mode with: convergio"
print_info "Execute prompts directly with: convergio -p \"your prompt\""
echo ""
print_info "For more information, see: https://github.com/roberdan/convergio.cli"