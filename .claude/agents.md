# Agent Coordination & Specialization

## Available Agent Types

| Agent | Focus Area |
|-------|------------|
| **Component Architect** | Component design, composition patterns |
| **State Manager** | Zustand store coordination |
| **UI/UX Designer** | Styling, animations, responsive design |
| **Testing Agent** | Jest, RTL, coverage optimization |
| **Performance Agent** | React.memo, useMemo, lazy loading |
| **API Developer** | Next.js API routes, database queries |

---

## Task Distribution Example

```
[Parallel Agents]:
  - Task("Component Architect: Design MovieCard with swipe gestures")
  - Task("State Manager: Create swipeStore with optimistic updates")
  - Task("Testing Agent: Write comprehensive tests for swipe flow")
```

---

## Web Development Swarm Orchestration

### Agent Roles for Filmber
```yaml
web_architect:
  role: System Designer
  focus: [next-app-structure, api-design, database-schema]
  concurrent_tasks: [component-hierarchy, api-routes, db-migrations]

frontend_developer:
  role: UI/UX Implementation
  focus: [react-components, framer-motion, tailwind-styling]
  concurrent_tasks: [multiple-components, animations, responsive-design]

backend_developer:
  role: API Development
  focus: [next-api-routes, drizzle-queries, socket-handlers]
  concurrent_tasks: [multiple-endpoints, db-operations, real-time-sync]

fullstack_tester:
  role: Quality Assurance
  focus: [jest-tests, rtl-components, api-integration]
  concurrent_tasks: [component-tests, hook-tests, api-tests]
```

### Swarm Topology
```bash
# Initialize development swarm for Filmber
npx claude-flow@alpha hive init --topology hierarchical --agents 5

# Agent distribution:
# - 1 Web Architect (coordinator)
# - 2 Frontend Developers (parallel component development)
# - 1 Backend Developer (API + Socket.io)
# - 1 Full-Stack Tester (comprehensive testing)
```

---

## 64 Specialized AI Agents

### Agent Categories
| Category | Agents | Description |
|----------|--------|-------------|
| Core Development | 5 | coder, planner, researcher, reviewer, tester |
| Swarm Coordination | 3 | hierarchical, mesh, adaptive coordinators |
| Consensus Systems | 7 | Byzantine, Raft, Gossip, CRDT protocols |
| GitHub Integration | 13 | PR management, code review, release automation |
| Performance | 6 | monitoring, load balancing, topology optimization |

### Agent Deployment
```bash
# Deploy multi-agent swarm
npx claude-flow@alpha swarm "Build REST API with authentication" --agents 8

# Concurrent agent deployment
[Parallel Agents]:
  - Task("System architecture", "...", "system-architect")
  - Task("Backend development", "...", "backend-dev")
  - Task("Test creation", "...", "tester")
```

---

## Recommended Agents for Filmber

```yaml
filmber_agents:
  frontend:
    - coder: "React components, Framer Motion animations"
    - reviewer: "Code review, accessibility checks"
    - tester: "Jest + RTL component tests"

  backend:
    - coder: "Next.js API routes, Drizzle queries"
    - researcher: "TMDB API integration, optimization"

  coordination:
    - planner: "Feature breakdown, task sequencing"
    - system-architect: "Architecture decisions"
```

---

## Agent Coordination Commands

### For Feature Development
```bash
# Initialize feature development
npx claude-flow@alpha swarm "implement [feature name]" --claude
```

### For Code Review
```bash
# Review changes
npx claude-flow@alpha github pr-review --file changed_files.txt
```

### For Testing
```bash
# Run comprehensive tests
npm test -- --coverage --watchAll=false
```

---

## Multi-Agent Feature Implementation

### Example: Implementing Notifications Feature

```
Phase 1 - Planning (Web Architect)
  → Define component hierarchy
  → Design API endpoints
  → Plan database schema

Phase 2 - Parallel Development
  [Frontend Developers]:
    - Task("Build NotificationList component")
    - Task("Build NotificationItem component")
    - Task("Build NotificationBadge component")

  [Backend Developer]:
    - Task("Create /api/notifications endpoints")
    - Task("Add notifications table migration")
    - Task("Implement Socket.io notifications")

Phase 3 - Testing (Full-Stack Tester)
  [Parallel]:
    - Task("Component tests for NotificationList")
    - Task("API integration tests")
    - Task("E2E notification flow test")

Phase 4 - Review (Code Reviewer)
  → Review all changes
  → Check accessibility
  → Validate type safety
```

---

## Agent Communication Patterns

### Hierarchical Communication
```
                  Web Architect
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Frontend Dev   Backend Dev     Tester
        │              │              │
        └──────────────┴──────────────┘
                 Shared Context
```

### Mesh Communication
```
   Frontend Dev ◄────► Backend Dev
        │                   │
        │       ┌───────────┘
        ▼       ▼
       Tester ◄──► Reviewer
```

---

## Best Practices

1. **Use hierarchical topology** for complex features
2. **Use mesh topology** for bug fixes and small tasks
3. **Always include a tester agent** for quality assurance
4. **Share context** between agents via memory store
5. **Review all parallel work** before merging
