#!/bin/bash

# Convergio CLI - Universal AI Agent Orchestration Platform
# Launcher script for the bundled CLI application

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_BUNDLE="$SCRIPT_DIR/bundle/convergio.js"

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

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ to run Convergio CLI."
    print_info "Visit: https://nodejs.org/en/download/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    print_info "Please upgrade Node.js: https://nodejs.org/en/download/"
    exit 1
fi

# Check if bundle exists
if [ ! -f "$CLI_BUNDLE" ]; then
    print_error "Convergio CLI bundle not found at: $CLI_BUNDLE"
    print_info "Please run 'npm run build' to generate the bundle."
    exit 1
fi

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
echo -e "${GREEN}Universal AI Agent Orchestration Platform${NC}"
echo -e "${YELLOW}Enterprise-Grade Multi-Agent System${NC}"
echo ""

# Check for help or version flags
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    print_info "Convergio CLI Launcher"
    echo ""
    echo "Usage: $0 [options...]"
    echo ""
    echo "This script launches the Convergio CLI with all provided arguments."
    echo "All CLI options are passed through to the underlying Node.js application."
    echo ""
    echo "Examples:"
    echo "  $0 --help                    # Show CLI help"
    echo "  $0 --list-extensions         # List available extensions"
    echo "  $0 -p \"create a file\"        # Execute prompt directly"
    echo "  $0                           # Start interactive mode"
    echo ""
    echo "For full CLI documentation, run: $0 --help"
    exit 0
fi

# Display startup info
print_info "Starting Convergio CLI..."
print_info "Bundle location: $CLI_BUNDLE"
print_info "Node.js version: $(node --version)"

# Check if running in interactive mode (no arguments)
if [ $# -eq 0 ]; then
    print_info "Starting in interactive mode..."
    print_warning "Press Ctrl+C to exit"
    echo ""
fi

# Launch the CLI with all provided arguments
print_success "Launching Convergio CLI..."
echo ""

# Execute the CLI
exec node "$CLI_BUNDLE" "$@"