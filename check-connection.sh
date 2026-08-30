#!/bin/bash

echo "🔍 Checking connection status..."
echo ""

# 1. Check git remote
echo "📌 Git remote URL:"
git remote -v | head -1
echo ""

# 2. Check if Vercel CLI is installed and linked
if command -v vercel &> /dev/null; then
    echo "✅ Vercel CLI is installed."
    echo ""
    echo "📦 Current Vercel project:"
    vercel project ls --all 2>/dev/null | grep -i "concept-cleaning" || echo "  (No project found or not linked)"
    echo ""
    echo "📋 Latest deployment (if any):"
    vercel deployment ls --all 2>/dev/null | head -3 || echo "  (No deployments found)"
else
    echo "❌ Vercel CLI not found. Please install it first."
fi

echo ""
echo "🌐 You can also verify the connection in your browser:"
echo "   https://vercel.com/josephkagenyo89-4090s-projects/concept-cleaning-portal/settings/git"
