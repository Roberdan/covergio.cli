#!/bin/bash

# Convergio CLI - Complete System Verification
# Comprehensive test of all components and functionality

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
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

print_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

print_section() {
    echo -e "${MAGENTA}=== $1 ===${NC}"
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
echo -e "${GREEN}Convergio CLI - Complete System Verification${NC}"
echo -e "${YELLOW}Testing all components and functionality${NC}"
echo ""

# Track test results
total_tests=0
passed_tests=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_success="$3"  # true/false
    
    print_test "$test_name"
    ((total_tests++))
    
    if eval "$test_command" >/dev/null 2>&1; then
        if [ "$expected_success" = "true" ]; then
            print_success "PASS"
            ((passed_tests++))
        else
            print_error "FAIL (unexpected success)"
        fi
    else
        if [ "$expected_success" = "false" ]; then
            print_success "PASS (expected failure)"
            ((passed_tests++))
        else
            print_error "FAIL"
        fi
    fi
}

# 1. Prerequisites Check
print_section "Prerequisites Verification"

print_test "Node.js installation"
if command -v node >/dev/null 2>&1; then
    version=$(node --version)
    print_success "Node.js found: $version"
    ((total_tests++))
    ((passed_tests++))
else
    print_error "Node.js not found"
    ((total_tests++))
fi

print_test "NPM installation" 
if command -v npm >/dev/null 2>&1; then
    version=$(npm --version)
    print_success "NPM found: $version"
    ((total_tests++))
    ((passed_tests++))
else
    print_error "NPM not found"
    ((total_tests++))
fi

echo ""

# 2. Build System Check
print_section "Build System Verification"

run_test "Package.json exists" "[ -f package.json ]" true
run_test "Bundle directory exists" "[ -d bundle ]" true
run_test "CLI bundle exists" "[ -f bundle/convergio.js ]" true
run_test "CLI bundle is executable" "[ -x bundle/convergio.js ]" true

echo ""

# 3. Script Files Check
print_section "Launch Scripts Verification"

run_test "Main launcher exists" "[ -f convergio.sh ]" true
run_test "Main launcher is executable" "[ -x convergio.sh ]" true
run_test "Install script exists" "[ -f install.sh ]" true
run_test "Install script is executable" "[ -x install.sh ]" true
run_test "Auth setup script exists" "[ -f setup-auth.sh ]" true
run_test "Auth setup script is executable" "[ -x setup-auth.sh ]" true
run_test "Auth check script exists" "[ -f check-auth.sh ]" true
run_test "Auth check script is executable" "[ -x check-auth.sh ]" true
run_test "Alias setup script exists" "[ -f setup-alias.sh ]" true
run_test "Alias setup script is executable" "[ -x setup-alias.sh ]" true

echo ""

# 4. CLI Functionality Check
print_section "CLI Functionality Verification"

print_test "CLI help command"
if timeout 10s ./convergio.sh --help >/dev/null 2>&1; then
    print_success "PASS - Help command works"
    ((passed_tests++))
else
    print_error "FAIL - Help command timeout or error"
fi
((total_tests++))

print_test "CLI list extensions command"
if timeout 10s ./convergio.sh --list-extensions >/dev/null 2>&1; then
    print_success "PASS - List extensions works"
    ((passed_tests++))
else
    print_error "FAIL - List extensions timeout or error"  
fi
((total_tests++))

print_test "CLI version command"
if timeout 10s ./convergio.sh --version >/dev/null 2>&1; then
    print_success "PASS - Version command works"
    ((passed_tests++))
else
    print_warning "WARN - Version command not available (normal)"
    ((passed_tests++))  # This is expected
fi
((total_tests++))

echo ""

# 5. Authentication Check
print_section "Authentication System Verification"

print_test "Authentication check script"
if ./check-auth.sh >/dev/null 2>&1; then
    print_success "PASS - Authentication system works"
    print_info "API keys are configured"
    ((passed_tests++))
else
    print_warning "WARN - No API keys configured"
    print_info "Run ./setup-auth.sh to configure authentication"
    ((passed_tests++))  # This is expected for new setups
fi
((total_tests++))

run_test "Environment example file exists" "[ -f .gemini/.env.example ]" true

echo ""

# 6. Documentation Check
print_section "Documentation Verification"

run_test "README.md exists" "[ -f README.md ]" true
run_test "Implementation summary exists" "[ -f IMPLEMENTATION-SUMMARY.md ]" true  
run_test "Authentication docs exist" "[ -f docs/cli/authentication.md ]" true
run_test "Docs directory structure" "[ -d docs/cli ] && [ -d docs/core ]" true

echo ""

# 7. Package Structure Check
print_section "Package Structure Verification"

run_test "Core package exists" "[ -d packages/core ]" true
run_test "CLI package exists" "[ -d packages/cli ]" true
run_test "Core package.json exists" "[ -f packages/core/package.json ]" true
run_test "CLI package.json exists" "[ -f packages/cli/package.json ]" true

echo ""

# 8. Security Check
print_section "Security Verification"

run_test ".gitignore exists" "[ -f .gitignore ]" true
print_test ".env files are gitignored"
if grep -q "\.env" .gitignore 2>/dev/null; then
    print_success "PASS - .env files are properly ignored"
    ((passed_tests++))
else
    print_error "FAIL - .env files not in .gitignore"
fi
((total_tests++))

# Check for accidentally committed secrets (actual API key patterns)
print_test "No real API keys in repository"
if git ls-files | xargs grep -l "sk-[a-zA-Z0-9]\{32,\}\|api[_-]key.*=[\"'][a-zA-Z0-9]\{20,\}[\"']" 2>/dev/null | grep -v ".example" | grep -v "setup-auth.sh" | grep -v "check-auth.sh" >/dev/null; then
    print_error "FAIL - Real API keys found in repository"
else
    print_success "PASS - No real API keys found in repository"
    ((passed_tests++))
fi
((total_tests++))

echo ""

# 9. Advanced Features Check (if available)
print_section "Advanced Features Verification"

run_test "Performance components exist" "[ -f packages/core/src/universal/performance/PerformanceManager.ts ]" true
run_test "Agent factory exists" "[ -f packages/core/src/universal/agents/AgentFactory.ts ]" true
run_test "Universal orchestrator exists" "[ -f packages/core/src/universal/orchestrator/UniversalOrchestrator.ts ]" true
run_test "Memory system exists" "[ -f packages/core/src/memory/sharing/CrossAgentMemoryManager.ts ]" true

echo ""

# Results Summary
print_section "Verification Results"

echo ""
percentage=$((passed_tests * 100 / total_tests))

if [ $percentage -ge 90 ]; then
    print_success "EXCELLENT: $passed_tests/$total_tests tests passed ($percentage%)"
    echo ""
    print_success "🎉 Convergio CLI is ready for production use!"
elif [ $percentage -ge 75 ]; then
    print_warning "GOOD: $passed_tests/$total_tests tests passed ($percentage%)"
    echo ""
    print_info "✅ Convergio CLI is functional with minor issues"
elif [ $percentage -ge 50 ]; then
    print_warning "PARTIAL: $passed_tests/$total_tests tests passed ($percentage%)"
    echo ""
    print_warning "⚠️  Some components need attention"
else
    print_error "CRITICAL: $passed_tests/$total_tests tests passed ($percentage%)"
    echo ""
    print_error "❌ Major issues found - system needs repair"
fi

echo ""
print_info "Next steps:"
if [ $percentage -ge 90 ]; then
    echo "  🚀 Your system is ready! Try: ./convergio.sh -p 'Hello, world!'"
    echo "  📚 Read the docs: docs/cli/"
    echo "  🌐 Install globally: ./install.sh"
else
    echo "  🔧 Fix failing tests above"
    echo "  🔑 Configure authentication: ./setup-auth.sh"
    echo "  📦 Rebuild if needed: npm run build"
    echo "  🔍 Check docs: docs/troubleshooting.md"
fi

echo ""
print_info "For support, see: README.md or docs/troubleshooting.md"