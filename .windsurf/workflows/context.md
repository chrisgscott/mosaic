---
auto_execution_mode: CASCADE_COMMANDS_AUTO_EXECUTION_OFF
description: Load all relevant project context from vault
---
Load all relevant context for the current project from my Obsidian vault.

VAULT LOCATION: /Users/chrisgscott/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian_vault/

TASK:
1. Ask which project to load context for (or infer from current directory/recent conversation)

2. Read and analyze:
   - /Projects/[Project Name].md - key decisions, architecture, status
   - /Vendors/[Client Name].md - if client project, read their preferences
   - Any linked Pattern files mentioned in the project file
   - Related RAG Learnings - if project involves RAG work

3. Present a concise context summary:
   
   🎯 **Project Goal:** [one line summary]
   
   🏗️ **Architecture:** [brief technical approach]
   
   ✅ **Recent Progress:** [what's been done recently]
   
   🔑 **Key Decisions:** 
   - [Decision 1 and why]
   - [Decision 2 and why]
   
   ⚠️ **Watch Out For:** 
   - [Constraints, preferences, gotchas from vendor/project]
   
   🔗 **Related Context:**
   - [[Pattern files being used]]
   - [[RAG learnings applied]]
   - [[Vendor preferences]]

4. End with: "What should we work on?"

Keep summary concise - just enough to get me up to speed quickly.
Maximum 10-12 bullet points total across all sections.