#!/bin/bash

# Claude-Flow Initialization Script for Filmber
# This script sets up Claude-Flow with ReasoningBank for the project

set -e

echo "🚀 Initializing Claude-Flow for Filmber..."

# Check if claude-flow is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx is not available. Please install Node.js first."
    exit 1
fi

# Create .swarm directory for memory storage
mkdir -p .swarm

# Initialize Claude-Flow
echo "📦 Installing Claude-Flow..."
npx claude-flow@alpha init --force

# Store project context in ReasoningBank
echo "🧠 Storing project context..."

npx claude-flow@alpha memory store filmber_stack \
  "Next.js 16 + React 19 + TypeScript + Zustand + Socket.io + PostgreSQL + Drizzle ORM" \
  --namespace filmber --reasoningbank

npx claude-flow@alpha memory store filmber_architecture \
  "Telegram Mini App with pair-mode movie matching, real-time WebSocket sync, multi-language support (EN/RU)" \
  --namespace filmber --reasoningbank

npx claude-flow@alpha memory store filmber_apis \
  "External APIs: TMDB (primary), OMDB (IMDb ratings), Kinopoisk (Russian ratings). All cached for 30 days." \
  --namespace filmber --reasoningbank

npx claude-flow@alpha memory store filmber_auth \
  "Authentication via Telegram WebApp initData with HMAC-SHA256 validation. JWT sessions stored in PostgreSQL." \
  --namespace filmber --reasoningbank

npx claude-flow@alpha memory store filmber_state \
  "Zustand stores: authStore, roomStore, swipeStore, queueStore, listStore, deckSettingsStore, referralStore, consentStore" \
  --namespace filmber --reasoningbank

# Store recommendation patterns (for future AI features)
echo "🎬 Storing recommendation patterns..."

npx claude-flow@alpha memory store genre_pattern_action \
  "Action movie fans often enjoy: thriller, sci-fi, adventure genres. Common preferences: high-paced, visual effects." \
  --namespace recommendations --reasoningbank

npx claude-flow@alpha memory store genre_pattern_drama \
  "Drama lovers typically appreciate: character development, emotional depth, realistic storytelling. Often enjoy romance, history." \
  --namespace recommendations --reasoningbank

npx claude-flow@alpha memory store genre_pattern_comedy \
  "Comedy fans usually like: light-hearted content, witty dialogue. Often crossover with romance, animation, family genres." \
  --namespace recommendations --reasoningbank

npx claude-flow@alpha memory store genre_pattern_scifi \
  "Sci-fi enthusiasts prefer: futuristic settings, technology themes, space exploration. Often enjoy thriller, mystery, action." \
  --namespace recommendations --reasoningbank

# Verify setup
echo "✅ Verifying setup..."
npx claude-flow@alpha memory status --reasoningbank

echo ""
echo "🎉 Claude-Flow initialization complete!"
echo ""
echo "📚 Usage examples:"
echo "  # Query project context"
echo "  npx claude-flow@alpha memory query 'architecture' --namespace filmber --reasoningbank"
echo ""
echo "  # Get recommendation patterns"
echo "  npx claude-flow@alpha memory query 'sci-fi fans' --namespace recommendations --reasoningbank"
echo ""
echo "  # Start a development swarm"
echo "  npx claude-flow@alpha swarm 'implement new feature' --claude"
echo ""
