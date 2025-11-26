#!/bin/bash

# Simple script to test if worker is working
# This creates a test job and verifies the worker processes it

set -e

echo "🧪 Testing Worker Functionality"
echo "================================"

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

# Check Redis
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis is not running. Please start Redis first:"
    echo "   docker-compose up -d redis"
    echo "   or: redis-server"
    exit 1
fi
echo "✅ Redis is running"

# Check Docker
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi
echo "✅ Docker is running"

# Check database
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set, using default: file:./local.db"
    export DATABASE_URL="file:./local.db"
fi
echo "✅ Database configured: $DATABASE_URL"

echo ""
echo "🚀 Starting worker test..."
echo ""

# Run the test
cd "$(dirname "$0")"
bun test src/worker.test.ts

echo ""
echo "✅ Worker test completed!"

