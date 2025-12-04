#!/bin/bash

# =============================================================================
# Mosaic - Interactive Project Setup Wizard
# =============================================================================
# This script walks you through setting up a new Mosaic project.
# It will:
#   1. Collect all required configuration
#   2. Create your .env files
#   3. Set up the Supabase database
#   4. Guide you through final manual steps
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Store collected values
declare -A CONFIG

# Helper functions
print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}▶${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

ask() {
    local prompt="$1"
    local var_name="$2"
    local default="$3"
    local secret="$4"
    
    if [ -n "$default" ]; then
        echo -e "${BOLD}$prompt${NC} [${default}]"
    else
        echo -e "${BOLD}$prompt${NC}"
    fi
    
    if [ "$secret" = "true" ]; then
        read -s -p "> " value
        echo ""
    else
        read -p "> " value
    fi
    
    if [ -z "$value" ] && [ -n "$default" ]; then
        value="$default"
    fi
    
    CONFIG[$var_name]="$value"
    echo ""
}

ask_required() {
    local prompt="$1"
    local var_name="$2"
    local secret="$3"
    
    while true; do
        ask "$prompt" "$var_name" "" "$secret"
        if [ -n "${CONFIG[$var_name]}" ]; then
            break
        fi
        print_error "This field is required."
        echo ""
    done
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

clear
echo ""
echo -e "${CYAN}"
echo "  ███╗   ███╗ ██████╗ ███████╗ █████╗ ██╗ ██████╗"
echo "  ████╗ ████║██╔═══██╗██╔════╝██╔══██╗██║██╔════╝"
echo "  ██╔████╔██║██║   ██║███████╗███████║██║██║     "
echo "  ██║╚██╔╝██║██║   ██║╚════██║██╔══██║██║██║     "
echo "  ██║ ╚═╝ ██║╚██████╔╝███████║██║  ██║██║╚██████╗"
echo "  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝ ╚═════╝"
echo -e "${NC}"
echo ""
echo -e "  ${BOLD}Interactive Project Setup Wizard${NC}"
echo ""
echo "  This wizard will help you set up a new Mosaic project."
echo "  You'll need:"
echo "    • A Supabase project (create at supabase.com)"
echo "    • An OpenAI API key (platform.openai.com)"
echo "    • A Cohere API key (dashboard.cohere.com - free tier available)"
echo ""
read -p "  Press Enter to continue..."

# =============================================================================
# STEP 1: Project Name
# =============================================================================

print_header "Step 1: Project Information"

ask "What would you like to name this project?" "PROJECT_NAME" "My Mosaic App"
print_success "Project: ${CONFIG[PROJECT_NAME]}"

# =============================================================================
# STEP 2: Supabase Configuration
# =============================================================================

print_header "Step 2: Supabase Configuration"

print_info "You can find these in your Supabase Dashboard:"
print_info "Settings > API > Project URL and keys"
echo ""

ask_required "Supabase Project URL (e.g., https://xxxxx.supabase.co)"  "SUPABASE_URL"

# Extract project ref
PROJECT_REF=$(echo "${CONFIG[SUPABASE_URL]}" | sed 's/https:\/\///' | sed 's/\.supabase\.co//')
print_success "Project ref: $PROJECT_REF"

ask_required "Supabase Anon/Publishable Key (starts with eyJ...)" "SUPABASE_ANON_KEY"
ask_required "Supabase Service Role Key (starts with eyJ...)" "SUPABASE_SERVICE_KEY" "true"

print_info "Database password is in Settings > Database > Connection string"
ask_required "Database Password" "SUPABASE_DB_PASSWORD" "true"

# Construct DATABASE_URL
CONFIG[DATABASE_URL]="postgresql://postgres.${PROJECT_REF}:${CONFIG[SUPABASE_DB_PASSWORD]}@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

print_success "Supabase configured!"

# =============================================================================
# STEP 3: API Keys
# =============================================================================

print_header "Step 3: API Keys"

print_info "Get your OpenAI key at: https://platform.openai.com/api-keys"
ask_required "OpenAI API Key (starts with sk-...)" "OPENAI_API_KEY" "true"

print_info "Get your Cohere key at: https://dashboard.cohere.com/api-keys"
print_info "Free tier includes 100 rerank requests/month"
ask_required "Cohere API Key" "COHERE_API_KEY" "true"

print_info "Optional: Tavily for web search (https://tavily.com)"
ask "Tavily API Key (optional, press Enter to skip)" "TAVILY_API_KEY" "" "true"

print_info "Optional: Google API Key for Gemini models (https://aistudio.google.com/apikey)"
ask "Google API Key (optional, press Enter to skip)" "GOOGLE_API_KEY" "" "true"

print_success "API keys configured!"

# =============================================================================
# STEP 4: Create .env files
# =============================================================================

print_header "Step 4: Creating Configuration Files"

# Create apps/web/.env
print_step "Creating apps/web/.env..."

cat > apps/web/.env << EOF
# =============================================================================
# ${CONFIG[PROJECT_NAME]} - Frontend Configuration
# Generated by Mosaic setup wizard
# =============================================================================

# Supabase
SUPABASE_DB_PASSWORD=${CONFIG[SUPABASE_DB_PASSWORD]}
NEXT_PUBLIC_SUPABASE_URL=${CONFIG[SUPABASE_URL]}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${CONFIG[SUPABASE_ANON_KEY]}
SUPABASE_SERVICE_ROLE_KEY=${CONFIG[SUPABASE_SERVICE_KEY]}

# OpenAI
OPENAI_API_KEY=${CONFIG[OPENAI_API_KEY]}

# Cohere (for reranking)
COHERE_API_KEY=${CONFIG[COHERE_API_KEY]}
EOF

if [ -n "${CONFIG[TAVILY_API_KEY]}" ]; then
    echo "" >> apps/web/.env
    echo "# Tavily (for web search)" >> apps/web/.env
    echo "TAVILY_API_KEY=${CONFIG[TAVILY_API_KEY]}" >> apps/web/.env
fi

print_success "Created apps/web/.env"

# Create apps/backend/ingest/.env
print_step "Creating apps/backend/ingest/.env..."

cat > apps/backend/ingest/.env << EOF
# =============================================================================
# ${CONFIG[PROJECT_NAME]} - Backend Configuration
# Generated by Mosaic setup wizard
# =============================================================================

# Supabase
SUPABASE_URL=${CONFIG[SUPABASE_URL]}
SUPABASE_SERVICE_ROLE_KEY=${CONFIG[SUPABASE_SERVICE_KEY]}
DATABASE_URL=${CONFIG[DATABASE_URL]}

# OpenAI
OPENAI_API_KEY=${CONFIG[OPENAI_API_KEY]}

# Docling Configuration
USE_DOCLING=true
USE_API_VLM=true
DOCLING_MAX_WORKERS=15

# Processing
POLL_INTERVAL=5
BATCH_SIZE=1
MAX_RETRIES=3
LOG_LEVEL=INFO

# Graph RAG
ENABLE_GRAPH_EXTRACTION=true
ENTITY_SIMILARITY_THRESHOLD=0.85
EOF

if [ -n "${CONFIG[GOOGLE_API_KEY]}" ]; then
    echo "" >> apps/backend/ingest/.env
    echo "# Google (for Gemini models)" >> apps/backend/ingest/.env
    echo "GOOGLE_API_KEY=${CONFIG[GOOGLE_API_KEY]}" >> apps/backend/ingest/.env
fi

print_success "Created apps/backend/ingest/.env"

# =============================================================================
# STEP 5: Set up Supabase Database
# =============================================================================

print_header "Step 5: Setting Up Database"

print_step "Applying Mosaic schema to Supabase..."
echo ""

# Export for the migration script
export SUPABASE_URL="${CONFIG[SUPABASE_URL]}"
export SUPABASE_SERVICE_ROLE_KEY="${CONFIG[SUPABASE_SERVICE_KEY]}"

cd supabase
if ./apply_migration.sh migrations/00000000_initial_schema.sql; then
    print_success "Database schema applied!"
else
    print_error "Failed to apply database schema."
    print_info "You can try manually: cd supabase && ./apply_migration.sh migrations/00000000_initial_schema.sql"
fi
cd ..

# =============================================================================
# STEP 6: Final Instructions
# =============================================================================

print_header "Step 6: Initialize Fresh Git Repository"

print_step "Removing Mosaic git history..."
rm -rf .git

print_step "Initializing new repository..."
git init
git add -A
git commit -m "Initial commit - ${CONFIG[PROJECT_NAME]} (built on Mosaic)"

print_success "Fresh git repository created"
echo ""
print_info "To push to GitHub:"
echo "  git remote add origin https://github.com/you/${CONFIG[PROJECT_NAME]}.git"
echo "  git push -u origin main"

print_header "Step 7: Final Steps (Manual)"

echo -e "${YELLOW}Almost done! Complete these steps in your Supabase Dashboard:${NC}"
echo ""

echo -e "${BOLD}1. Create Storage Bucket${NC}"
echo "   • Go to: ${CONFIG[SUPABASE_URL]}/project/default/storage/buckets"
echo "   • Click 'New bucket'"
echo "   • Name: documents"
echo "   • Public: No (unchecked)"
echo ""

echo -e "${BOLD}2. Set Storage Policies${NC}"
echo "   • Go to: Storage > Policies"
echo "   • Add these policies for the 'documents' bucket:"
echo ""
echo "   ${CYAN}-- Allow authenticated uploads${NC}"
echo "   ${CYAN}CREATE POLICY \"Allow uploads\" ON storage.objects${NC}"
echo "   ${CYAN}  FOR INSERT WITH CHECK (bucket_id = 'documents');${NC}"
echo ""
echo "   ${CYAN}-- Allow users to view files${NC}"
echo "   ${CYAN}CREATE POLICY \"Allow view\" ON storage.objects${NC}"
echo "   ${CYAN}  FOR SELECT USING (bucket_id = 'documents');${NC}"
echo ""
echo "   ${CYAN}-- Allow users to delete files${NC}"
echo "   ${CYAN}CREATE POLICY \"Allow delete\" ON storage.objects${NC}"
echo "   ${CYAN}  FOR DELETE USING (bucket_id = 'documents');${NC}"
echo ""

echo -e "${BOLD}3. Create Your Admin Account${NC}"
echo "   • Start the app: ./start-frontend.sh"
echo "   • Sign up with your email"
echo "   • Then run this SQL in Supabase SQL Editor:"
echo ""
echo "   ${CYAN}UPDATE profiles SET is_admin = true WHERE email = 'your@email.com';${NC}"
echo ""

print_header "Setup Complete! 🎉"

echo -e "Your ${BOLD}${CONFIG[PROJECT_NAME]}${NC} project is ready!"
echo ""
echo "To start developing:"
echo ""
echo "  ${CYAN}# Terminal 1: Frontend${NC}"
echo "  ./start-frontend.sh"
echo ""
echo "  ${CYAN}# Terminal 2: Backend (document processing)${NC}"
echo "  ./start-backend.sh"
echo ""
echo "Then open ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "${GREEN}Happy building! 🚀${NC}"
echo ""
