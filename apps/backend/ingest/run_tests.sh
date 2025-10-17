#!/bin/bash

# Test runner for backend ingest worker
# Usage: ./run_tests.sh [options]
#
# Options:
#   --unit          Run only unit tests
#   --integration   Run only integration tests
#   --coverage      Generate coverage report
#   --watch         Watch for changes and re-run tests

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Mosaic Backend Tests ===${NC}\n"

# Check if pytest is installed
if ! python -c "import pytest" 2>/dev/null; then
    echo "Installing test dependencies..."
    pip install -r requirements-test.txt
fi

# Parse arguments
PYTEST_ARGS=""

if [ "$1" = "--unit" ]; then
    echo "Running unit tests only..."
    PYTEST_ARGS="-m unit"
elif [ "$1" = "--integration" ]; then
    echo "Running integration tests only..."
    PYTEST_ARGS="-m integration"
elif [ "$1" = "--coverage" ]; then
    echo "Running tests with coverage report..."
    PYTEST_ARGS="--cov=. --cov-report=html --cov-report=term"
elif [ "$1" = "--watch" ]; then
    echo "Running tests in watch mode..."
    pip install pytest-watch 2>/dev/null || true
    ptw -- tests/
    exit 0
else
    echo "Running all tests..."
fi

# Run pytest
python -m pytest $PYTEST_ARGS tests/

# Check exit code
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
else
    echo -e "\n${RED}✗ Some tests failed${NC}"
    exit 1
fi

# Show coverage report location if generated
if [ "$1" = "--coverage" ]; then
    echo -e "\n${BLUE}Coverage report generated: htmlcov/index.html${NC}"
fi
