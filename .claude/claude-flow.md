# Claude-Flow Configuration

## Quick Start

```bash
# Initialize Claude-Flow
npx claude-flow@alpha init

# Query project context
npx claude-flow@alpha memory query "architecture" --namespace filmber --reasoningbank

# Start development swarm
npx claude-flow@alpha swarm "implement feature" --claude
```

---

## Memory Operations

### Store Context
```bash
npx claude-flow@alpha memory store key "value" --namespace filmber
```

### Query Memory
```bash
npx claude-flow@alpha memory query "search term" --namespace filmber
```

### Vector Search (Semantic)
```bash
npx claude-flow@alpha memory vector-search "cyberpunk noir" \
  --k 10 --threshold 0.7 --namespace movies
```

### Status
```bash
npx claude-flow@alpha memory status --reasoningbank
```

---

## Recommendations Integration (Future)

### AgentDB Vector Search Setup
```bash
# For semantic movie search
npx claude-flow@alpha memory vector-search "cyberpunk noir detective" \
  --k 10 --threshold 0.7 --namespace movies
```

### Store Movie Embeddings
```bash
npx claude-flow@alpha memory store-vector movie_123 "Sci-fi thriller about time travel" \
  --namespace movies --metadata '{"tmdbId": 123, "genres": ["sci-fi", "thriller"]}'
```

---

## Truth Verification System

```bash
# Initialize with verification mode
npx claude-flow@alpha init --verify

# Run verification
npx claude-flow@alpha verify init strict     # 0.95 threshold
npx claude-flow@alpha verify status          # Check system status
npx claude-flow@alpha verify verify task-123 --agent coder
npx claude-flow@alpha truth                  # View truth scores
```

**Features:**
- 0.95 Truth Threshold (95% accuracy required)
- Auto-Rollback on verification failures
- Byzantine Fault Tolerance
- Real-time monitoring

---

## Pair Programming Mode

```bash
# Start collaborative session
npx claude-flow@alpha init --pair
npx claude-flow@alpha pair --start

# Combined verification + pair programming
npx claude-flow@alpha init --verify --pair
```

---

## Training Pipeline

```bash
# Train agents for better performance
npx claude-flow@alpha train-pipeline run --complexity medium --iterations 3
npx claude-flow@alpha train-pipeline status    # View agent profiles
npx claude-flow@alpha train-pipeline validate  # Check metrics
npx claude-flow@alpha verify-train feed        # Feed verification data
npx claude-flow@alpha verify-train predict default coder
```

---

## Neural & Goal Modules

### SAFLA Neural Module
```bash
# Initialize neural module
npx claude-flow@alpha neural init
npx claude-flow@alpha neural init --force  # Overwrite existing
```

**Capabilities:**
- Self-learning AI systems
- 4-tier memory architecture
- 172K+ ops/sec performance
- Persistent memory storage

### GOAP Goal Module
```bash
# Initialize goal planning module
npx claude-flow@alpha goal init
npx claude-flow@alpha goal init --force
```

**Capabilities:**
- Intelligent planning systems
- A* pathfinding algorithms
- Adaptive replanning
- Goal decomposition

---

## Stream Chaining (Agent-to-Agent Piping)

### Real-time Output Streaming
```bash
# Stream JSON output between agents
npx claude-flow@alpha automation mle-star \
  --dataset data.csv \
  --target price \
  --claude \
  --output-format stream-json
```

**Use Cases:**
- Agent-to-agent communication
- Real-time data processing
- Pipeline orchestration

---

## Benchmark System

### Performance Testing
```bash
# Run benchmarks
swarm-bench run "Build REST API" --strategy development --max-agents 6
swarm-bench swarm "Create auth system" --mode hierarchical --parallel
swarm-bench sparc coder "Implement feature" --timeout 60
```

### SWE-bench Integration
```bash
# Official software engineering benchmark
swarm-bench swe-bench official --limit 10    # Test 10 instances
swarm-bench swe-bench multi-mode --instances 5  # Compare all modes
swarm-bench swe-bench official --lite        # Full evaluation (300)
```

**Performance Metrics:**
- 84.8% SWE-Bench solve rate
- 32.3% token reduction
- 2.8-4.4x speed improvement

---

## Quick Reference Commands

### Initialization
```bash
# Standard init
npx claude-flow@alpha init

# GitHub-enhanced init
npx claude-flow@alpha github init

# With options
npx claude-flow@alpha init --verify --pair --force
```

### Hive-Mind Operations
```bash
# Initialize swarm
npx claude-flow@alpha hive init --topology mesh --agents 5

# Spawn tasks
npx claude-flow@alpha hive-mind spawn "implement feature" --claude

# Check status
npx claude-flow@alpha hive-mind status
```

### SPARC Development
```bash
# Run SPARC mode
npx claude-flow@alpha sparc run dev "build user authentication"

# Full orchestration
npx claude-flow@alpha orchestrate "create REST API with tests" \
  --agents 8 --parallel
```

### Automation
```bash
# MLE-STAR workflow
npx claude-flow@alpha automation mle-star \
  --dataset data.csv \
  --target label \
  --claude

# Auto-agent spawning
npx claude-flow@alpha automation auto-agent --task-complexity enterprise

# Run workflow
npx claude-flow@alpha automation run-workflow workflow.json \
  --claude --non-interactive
```

---

## Filmber-Specific Claude-Flow Usage

### Feature Development Workflow
```bash
# 1. Initialize swarm for new feature
npx claude-flow@alpha swarm "implement movie lists page" --claude

# 2. Store context
npx claude-flow@alpha memory store lists_feature \
  "MovieListGrid, MovieListItem, filters, infinite scroll" \
  --namespace filmber

# 3. Run with verification
npx claude-flow@alpha verify verify lists-implementation --agent coder
```

### AI Recommendations Pipeline (Future)
```bash
# Store movie embeddings
npx claude-flow@alpha memory store-vector movie_550 \
  "Fight Club - psychological thriller about identity and consumerism" \
  --namespace movies \
  --metadata '{"tmdbId": 550, "genres": ["drama", "thriller"]}'

# Semantic search for recommendations
npx claude-flow@alpha memory vector-search \
  "dark psychological thriller with twist ending" \
  --k 20 --threshold 0.6 --namespace movies

# Query learned patterns
npx claude-flow@alpha memory query "user preferences sci-fi" \
  --namespace recommendations --reasoningbank
```
