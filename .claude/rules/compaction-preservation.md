<!-- v2.0.0 -->
# Compaction Preservation

When rewriting or compacting ANY file, NEVER remove:
- Build/test commands (npm run preflight, npm test, npm run build)
- Core rules (7 rules from CLAUDE.md)
- Architecture references (package structure, tools, MCP)
- @import/@reference directives
- Version headers (<!-- v2.0.0 -->)
- Hook configurations
- Security rules (secret scanning, CSP)

If compacting reduces a file below functional threshold, STOP and ask user.
