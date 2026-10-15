---
id: "202610152121-B8B5RR"
title: "Protect merged directory records from bulk publication"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: []
tags: ["code", "backend", "directory"]
verify: ["npm test"]
doc_version: 2
doc_updated_at: "2026-10-15T21:21:30+00:00"
doc_updated_by: "agentctl"
description: "Replace unsafe publish-all behavior with validation that refuses merged duplicates, malformed records, disallowed provenance, and unresolved canonical chains; add an audit preview and tests."
---
