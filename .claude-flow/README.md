# Claude-Flow Configuration for Filmber

This directory contains Claude-Flow configuration files for AI-assisted development.

## Files

- `config.yml` - Main Claude-Flow configuration
- `recommendations.yml` - AI recommendations system configuration

## Quick Start

### 1. Initialize Claude-Flow

```bash
# Run initialization script
chmod +x scripts/init-claude-flow.sh
./scripts/init-claude-flow.sh

# Or manually
npx claude-flow@alpha init --force
```

### 2. Query Project Context

```bash
# Get architecture info
npx claude-flow@alpha memory query "architecture" --namespace filmber --reasoningbank

# Get API integration info
npx claude-flow@alpha memory query "APIs" --namespace filmber --reasoningbank
```

### 3. Start Development Swarm

```bash
# Quick task
npx claude-flow@alpha swarm "implement search filters" --claude

# Complex feature
npx claude-flow@alpha hive-mind spawn "add user notifications" --claude
```

## Recommendation System (Future)

### Semantic Movie Search

```bash
# Search for similar movies
npx claude-flow@alpha memory vector-search "cyberpunk noir detective" \
  --k 10 --threshold 0.7 --namespace movies
```

### Store Movie Embeddings

```bash
# Store movie with semantic embedding
npx claude-flow@alpha memory store-vector movie_550 \
  "Fight Club - psychological thriller about consumerism and identity crisis" \
  --namespace movies \
  --metadata '{"tmdbId": 550, "genres": ["drama", "thriller"]}'
```

### Query Patterns

```bash
# Get recommendation patterns
npx claude-flow@alpha memory query "sci-fi fans" --namespace recommendations --reasoningbank
```

## Configuration Options

### Memory Backend

Currently using **ReasoningBank** (SQLite-based, no API keys required):
- 2-3ms query latency
- Works offline
- Pattern-based search

For production AI recommendations, enable **AgentDB**:
- 96x faster vector search
- Semantic understanding
- Requires OpenAI API key for embeddings (optional)

### Enable AgentDB

1. Edit `config.yml`:
```yaml
agentdb:
  enabled: true
```

2. Install AgentDB:
```bash
npm install agentdb@1.3.9
```

3. (Optional) Set OpenAI API key for better embeddings:
```bash
export OPENAI_API_KEY=your_key
```

## Directory Structure

```
.claude-flow/
├── config.yml           # Main configuration
├── recommendations.yml  # AI recommendations config
└── README.md           # This file

.swarm/
└── memory.db           # ReasoningBank SQLite storage (gitignored)
```

## Useful Commands

```bash
# Check memory status
npx claude-flow@alpha memory status --reasoningbank

# List all stored memories
npx claude-flow@alpha memory list --namespace filmber --reasoningbank

# Clear namespace
npx claude-flow@alpha memory clear --namespace filmber --reasoningbank

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```
