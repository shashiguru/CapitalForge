# CapitalForge — Project Operating System

AI-assisted project memory and agent coordination for Cursor.

## Quick Start for Agents

```
1. Read docs/PROJECT_CONTEXT.md
2. Check docs/FEATURE_BACKLOG.md for your task
3. Load skills/<domain>-skill.md
4. Work → update TIME_LOG.md + FEATURE_BACKLOG.md
```

## Structure

```
project-operating-system/
├── docs/           # Project memory (10 documents)
├── skills/         # Reusable agent instruction packs (9 skills)
└── .cursor/rules/  # Cursor rule files (4 rules)
```

## Cursor Rules

Rules are also copied to `/.cursor/rules/` at repo root for Cursor auto-loading.

| Rule | Purpose |
|------|---------|
| `project-rules.mdc` | Startup protocol, scope discipline, doc updates |
| `coding-standards.mdc` | Naming, organization, error handling |
| `architecture-rules.mdc` | Module boundaries, API, security |
| `git-workflow.mdc` | Branches, commits, PRs, releases |

## Document Index

| Document | Purpose |
|----------|---------|
| [PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) | Business overview, tech stack, agent behavior |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, diagrams, data flow |
| [FEATURE_BACKLOG.md](docs/FEATURE_BACKLOG.md) | Sprint tracking, priorities |
| [DECISION_LOG.md](docs/DECISION_LOG.md) | Architecture decision records |
| [TIME_LOG.md](docs/TIME_LOG.md) | Engineering effort log |
| [DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) | Local setup, commands |
| [API_CONTRACTS.md](docs/API_CONTRACTS.md) | Endpoint specifications |
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Production deployment |
| [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Bugs and tech debt |
| [RELEASE_NOTES.md](docs/RELEASE_NOTES.md) | Version history |

## Skills Index

| Skill | Use When |
|-------|----------|
| [frontend-skill.md](skills/frontend-skill.md) | UI, pages, components |
| [backend-skill.md](skills/backend-skill.md) | API, services, DTOs |
| [database-skill.md](skills/database-skill.md) | Schema, migrations |
| [testing-skill.md](skills/testing-skill.md) | Tests, coverage |
| [reporting-skill.md](skills/reporting-skill.md) | Management reports |
| [debugging-skill.md](skills/debugging-skill.md) | Bug investigation |
| [code-review-skill.md](skills/code-review-skill.md) | PR review |
| [architecture-skill.md](skills/architecture-skill.md) | Design decisions |
| [prd-skill.md](skills/prd-skill.md) | Requirements writing |

## Related

- [PRD.md](../PRD.md) — Product requirements (repo root)
- [README.md](../README.md) — Project README
