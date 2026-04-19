---
id: "202604191752-QSB7GA"
title: "Graph CityBeat app with Graphify"
status: "DONE"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "925067d927ebfb6167ae8344675dd1e1f4e6f4e1", message: "📝 QSB7GA document Graphify app graph setup and scoped outputs" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: install Graphify locally, scope the graph to CityBeat app code, generate AST graph outputs, and document limitations around skipped semantic extraction." }
  - { author: "ORCHESTRATOR", body: "verified: generated Graphify AST graph outputs, confirmed graph.html graph.json and GRAPH_REPORT.md exist, and benchmark reported 38.5x token reduction." }
doc_version: 2
doc_updated_at: "2026-04-19T17:57:17+00:00"
doc_updated_by: "agentctl"
description: "Install Graphify from safishamsi/graphify and generate a knowledge graph for the CityBeat app/codebase surface, excluding the large article/media archive so the result focuses on architecture and implementation."
---
## Summary

Installed Graphify from https://github.com/safishamsi/graphify.git into .graphify-venv and generated a local AST-based knowledge graph for the CityBeat app surface. Outputs are in graphify-out/graph.html, graphify-out/graph.json, and graphify-out/GRAPH_REPORT.md.

## Scope

Included app/code directories and root project docs after excluding src/lib/articles and media, tmpclaude-* directories, and the root codex-swarm helper checkout via .graphifyignore. Detection found 244 supported files and AST extraction processed 194 code files, producing 432 graph nodes, 562 edges, and 121 communities.

## Risks

Graphify semantic extraction was not run because the scoped corpus still exceeded the 200-file warning threshold and this session did not have explicit multi-agent extraction approval. The generated graph is therefore strongest for code structure, imports, and inferred call relationships, and weaker for design rationale in docs, PDFs, and images.

## Verify Steps

Ran Graphify detection with .graphifyignore active, ran local AST extraction for 194 code files, exported graph.html/graph.json/GRAPH_REPORT.md, and ran graphify benchmark graphify-out\\graph.json. Benchmark reported 38.5x fewer tokens per query versus reading the detected corpus directly.

## Rollback Plan

Remove .graphify-venv, graphify-out, .graphifyignore, and the Graphify ignore entries in .gitignore to return the repository to its previous graph-free state. No app runtime code was modified.

## Notes

Generated outputs are intentionally ignored by git in this run. Pre-existing unrelated changes remain untouched: .env.production.template and the untracked src/lib/articles and media directory.

