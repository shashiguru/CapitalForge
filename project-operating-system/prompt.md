You are a senior Staff Engineer and AI Engineering Architect.

Your task is to create a complete AI-assisted Project Operating System for this repository so Cursor agents can work efficiently across multiple chats without repeatedly re-understanding the entire project.

GOAL
The system must:
1. Reduce token usage across Cursor chats
2. Allow multiple feature development workflows
3. Maintain project memory and architectural decisions
4. Track implementation progress
5. Track management reporting and engineering effort
6. Improve consistency between agents
7. Prevent unnecessary refactors
8. Enable reusable “skills” similar to Claude Skills

CREATE THE FOLLOWING STRUCTURE

/project-operating-system
  /docs
    PROJECT_CONTEXT.md
    ARCHITECTURE.md
    FEATURE_BACKLOG.md
    DECISION_LOG.md
    TIME_LOG.md
    DEVELOPMENT_GUIDE.md
    API_CONTRACTS.md
    DEPLOYMENT_GUIDE.md
    KNOWN_ISSUES.md
    RELEASE_NOTES.md

  /skills
    frontend-skill.md
    backend-skill.md
    database-skill.md
    testing-skill.md
    reporting-skill.md
    debugging-skill.md
    code-review-skill.md
    architecture-skill.md
    prd-skill.md

  /.cursor/rules
    project-rules.mdc
    coding-standards.mdc
    architecture-rules.mdc
    git-workflow.mdc

REQUIREMENTS

1. PROJECT_CONTEXT.md
Must contain:
- Business overview
- Product vision
- Current goals
- Tech stack
- Folder structure
- Coding conventions
- API conventions
- Authentication flow
- Environments
- Important business rules
- Current active modules
- Future roadmap
- How agents should behave

2. ARCHITECTURE.md
Must contain:
- High-level architecture
- Frontend architecture
- Backend architecture
- Database architecture
- Event flow
- Authentication flow
- API flow
- Deployment architecture
- Caching strategy
- Queue/event strategy
- Error handling strategy
- Scalability considerations
- Mermaid diagrams

3. FEATURE_BACKLOG.md
Must contain:
- Feature status tracking
- Priority
- Owner
- Dependencies
- Sprint tracking
- Risks
- Acceptance criteria
- Current progress
- Blockers
- Next actions

Use table format.

4. DECISION_LOG.md
Must contain:
- Architectural decisions
- Why decisions were made
- Alternatives considered
- Risks
- Tradeoffs
- Decision owners
- Dates

5. TIME_LOG.md
Must contain:
- Daily engineering log
- Feature worked on
- Estimated time
- Actual time
- Blockers
- Outcome
- Next actions

Use reusable templates.

6. DEVELOPMENT_GUIDE.md
Must contain:
- Local setup
- Environment variables
- Build commands
- Test commands
- Debugging steps
- PR workflow
- Release workflow
- Branch naming conventions

7. API_CONTRACTS.md
Must contain:
- Endpoint conventions
- Request/response patterns
- Error response structure
- Authentication requirements
- API versioning standards
- Pagination standards

8. KNOWN_ISSUES.md
Must contain:
- Current bugs
- Technical debt
- Temporary workarounds
- Future improvements

9. RELEASE_NOTES.md
Must contain:
- Release template
- Change categories
- Version history structure

SKILLS REQUIREMENTS

Each skill file must behave like a reusable AI operating instruction.

frontend-skill.md
- UI architecture rules
- Component structure
- State management rules
- Styling conventions
- Performance optimization
- Accessibility rules
- Anti-patterns

backend-skill.md
- API design principles
- Service structure
- Validation rules
- Error handling
- Logging standards
- Security standards
- Scalability standards

database-skill.md
- Schema design standards
- Migration strategy
- Indexing strategy
- Query optimization
- Naming conventions

testing-skill.md
- Unit testing strategy
- Integration testing
- E2E testing
- Mocking standards
- Coverage expectations

reporting-skill.md
- How to generate management reports
- Sprint summaries
- ROI reporting
- Productivity reporting
- Risk reporting
- Weekly engineering summaries

debugging-skill.md
- Root cause analysis process
- Logging approach
- Isolation strategy
- Performance debugging
- Production debugging checklist

code-review-skill.md
- PR review checklist
- Security checks
- Performance checks
- Maintainability checks
- Scalability checks
- Refactoring rules

architecture-skill.md
- System design principles
- Distributed systems guidance
- Cloud-native guidance
- Event-driven architecture guidance
- Scaling guidance

prd-skill.md
- PRD writing standards
- User story format
- Acceptance criteria standards
- Functional requirements structure
- Non-functional requirements structure

CURSOR RULES REQUIREMENTS

project-rules.mdc
- Always read PROJECT_CONTEXT.md first
- Never refactor unrelated modules
- Update TIME_LOG.md after work
- Update DECISION_LOG.md for architectural changes
- Update FEATURE_BACKLOG.md progress
- Prefer modular code
- Prefer reusable components
- Keep features isolated

coding-standards.mdc
- Naming conventions
- File organization
- Clean code rules
- Documentation requirements
- Error handling standards
- Logging standards

architecture-rules.mdc
- Microservice boundaries
- API boundaries
- Event-driven rules
- Scalability rules
- Security rules

git-workflow.mdc
- Branch naming
- Commit naming
- PR naming
- Merge strategy
- Release tagging

IMPORTANT INSTRUCTIONS

1. Generate REALISTIC professional content, not placeholders only.
2. Use markdown formatting properly.
3. Include reusable templates wherever useful.
4. Add examples.
5. Add tables where appropriate.
6. Add Mermaid diagrams.
7. Make everything production-grade.
8. Make the system suitable for large enterprise applications.
9. Optimize for AI-agent collaboration.
10. Optimize for long-term maintainability.
11. Ensure all documents are interconnected.
12. Include “How AI agents should use this document” sections in important files.

FINAL STEP

After creating all files:
1. Explain the purpose of each file
2. Explain how Cursor agents should use them
3. Explain the workflow for feature development
4. Explain the workflow for management reporting
5. Explain how this reduces token usage and improves consistency