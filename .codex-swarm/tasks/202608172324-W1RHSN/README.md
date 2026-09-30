---
id: "202608172324-W1RHSN"
title: "Verify production article image submission pipeline"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["production", "testing", "articles"]
verify: ["Invoke-RestMethod -Uri https://citybeatmag.co/api/health -Method Get"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: run one traceable production image submission, verify the created submission and image through the public response and authenticated review flow, and clean up only the uniquely labeled test data after preserving evidence." }
doc_version: 2
doc_updated_at: "2026-08-17T23:24:17+00:00"
doc_updated_by: "agentctl"
description: "Submit one clearly labeled production test article with a real image, confirm intake, storage, review-queue promotion, and image retrieval, preserve evidence, then remove only the temporary test record without affecting the real contributor submission."
---
