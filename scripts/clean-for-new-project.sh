#!/bin/bash

# =============================================================================
# Clean Mosaic for New Project
# =============================================================================
# Run this after cloning Mosaic to remove core development docs and files
# that aren't needed for building apps on top of Mosaic.
#
# Usage: ./scripts/clean-for-new-project.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}▶${NC} $1"
}

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Clean Mosaic for New Project${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "This will remove Mosaic core development files that aren't needed"
echo "for building apps on top of Mosaic:"
echo ""
echo "  • docs/archive/          - Old planning docs, phase docs"
echo "  • docs/reference/        - RAG research, chunking studies"
echo "  • docs/refactor/         - Refactoring notes"
echo "  • docs/architecture/     - Core architecture docs"
echo "  • docs/technical_audit.md"
echo "  • docs/README.md         - Mosaic docs index"
echo "  • LEARNINGS/             - Development learnings"
echo "  • tests/                 - Mosaic core tests"
echo "  • backend examples/      - Chunking config examples"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""

# Remove docs that are Mosaic-core specific
echo -e "${GREEN}▶${NC} Removing Mosaic core docs..."

rm -rf docs/archive
rm -rf docs/reference
rm -rf docs/refactor
rm -rf docs/architecture
rm -f docs/technical_audit.md
rm -f docs/README.md

echo -e "${GREEN}✓${NC} Removed docs/archive, docs/reference, docs/refactor, docs/architecture"

# Remove LEARNINGS (development notes)
if [ -d "LEARNINGS" ]; then
    rm -rf LEARNINGS
    echo -e "${GREEN}✓${NC} Removed LEARNINGS/"
fi

# Remove tests directory (Mosaic core tests)
if [ -d "tests" ]; then
    rm -rf tests
    echo -e "${GREEN}✓${NC} Removed tests/"
fi

# Remove example chunking configs (Mosaic development examples)
if [ -d "apps/backend/ingest/examples" ]; then
    rm -rf apps/backend/ingest/examples
    echo -e "${GREEN}✓${NC} Removed apps/backend/ingest/examples/"
fi

# Clean up docs directory - keep only guides and API
echo -e "${GREEN}▶${NC} Keeping docs/guides/ and docs/API.md for reference"

# Create a fresh docs README for the new project
cat > docs/README.md << 'EOF'
# Documentation

This directory contains documentation for your project.

## Available Docs

- **[API.md](./API.md)** - Search and Chat API reference
- **[guides/](./guides/)** - Setup and development guides

## Add Your Docs

Add your project-specific documentation here:
- Architecture decisions
- Feature specs
- API documentation
- User guides
EOF

echo -e "${GREEN}✓${NC} Created fresh docs/README.md"

# Commit the cleanup
echo ""
print_step "Committing cleanup..."
git add -A
git commit -m "Clean up Mosaic core development files" 2>/dev/null || true
echo -e "${GREEN}✓${NC} Changes committed"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Cleanup Complete!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Your project is now clean and ready for development."
echo ""
echo "Remaining docs:"
echo "  • README.md              - Project overview"
echo "  • BUILDING_ON_MOSAIC.md  - API integration guide"
echo "  • docs/API.md            - API reference"
echo "  • docs/guides/           - Setup guides"
echo ""
echo -e "${GREEN}Happy building! 🚀${NC}"
echo ""
