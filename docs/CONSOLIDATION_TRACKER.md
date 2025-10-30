# Documentation Consolidation Tracker

**Created:** October 29, 2025  
**Status:** In Progress

## Process

1. ✅ **Move all MD files** → `docs/to_organize/`
2. ⏳ **Read & categorize** → Assign to buckets
3. ⏳ **Synthesize buckets** → One SSoT per bucket
4. ⏳ **Master plan** → Top-level orchestration
5. ⏳ **Archive old versions** → Move superseded docs
6. ⏳ **Create index** → `docs/README.md`

---

## Bucket Structure

```
/ (root)
├── README.md                    # Project overview (NEW - stays in root)
├── BUILD_PLAN.md                # Master plan + Workflow file (STAYS IN ROOT - used by /cleanup)
├── INBOX.md                     # Workflow file (STAYS IN ROOT - used by /cleanup)
├── TO_PROCESS.md                # Workflow file (STAYS IN ROOT - used by workflows)
├── BUGS.md                      # Workflow file (STAYS IN ROOT - used by /bug)
└── docs/
    ├── README.md                # Master index (to create)
    ├── architecture/            # How it works
    ├── features/                # What it does  
    ├── guides/                  # How to use it
    ├── planning/                # What's next (non-workflow planning docs)
    ├── completed/               # What's done
    ├── reference/               # Technical specs
    ├── archive/                 # Historical docs
    ├── from_r2r_project/        # R2R learnings
    ├── living_entities/         # Living Entities docs
    └── to_organize/             # Staging area (28 files)
```

**Important:** `BUILD_PLAN.md`, `INBOX.md`, `TO_PROCESS.md`, and `BUGS.md` are **workflow files** used by `/cleanup`, `/bug`, and other workflows. They MUST stay in root directory.

---

## Files to Categorize (28 total)

### To Review:
- [ ] ACTION_PLAN.md
- [ ] AGENTIC_CHUNKING_SUMMARY.md
- [ ] AI_SDK_MIGRATION_TESTS.md
- [ ] ARCHITECTURE_DECISION.md
- [ ] BUGS.md
- [ ] BUILD_PLAN.md
- [ ] CHUNKING_IMPROVEMENTS_PLAN.md
- [ ] COMPLETED_ITEMS.md
- [ ] FRONTEND_STATUS.md
- [ ] GETTING_STARTED.md
- [ ] GRAPH_EXTRACTION_PERFORMANCE_FIX.md
- [ ] HARDCODED_MODELS_CLEANUP.md
- [ ] INBOX_CLEANUP_SUMMARY.md
- [ ] INBOX.md
- [ ] LIVING_ENTITIES_SUMMARY.md
- [ ] MODEL_DROPDOWN_IMPLEMENTATION.md
- [ ] mosaic_for_x.md
- [ ] ORIENTATION.md
- [ ] PHASE_14_15_16_PROPOSALS.md
- [ ] PHASE_2.1_TESTING.md
- [ ] PHASE_6.5_COMPLETE.md
- [ ] PLANNER_EXECUTOR_PATTERN.md
- [ ] PROMPT_MANAGEMENT_SYSTEM.md
- [ ] RAG_BEST_PRACTICES.md
- [ ] RELATIONSHIP_EXTRACTION_FIX.md
- [ ] SYNTHESIS.md
- [ ] test-n8n-headers.md
- [ ] TO_PROCESS.md

---

## Categorization Plan

### architecture/ (How it works)
- System design decisions
- Multifloor architecture
- Core principles

### features/ (What it does)
- Feature documentation
- Implementation details
- Technical specs

### guides/ (How to use it)
- Getting started
- Tutorials
- Best practices

### planning/ (What's next)
- Future roadmap
- Proposals
- Ideas to process

### completed/ (What's done)
- Completed phases
- Migration summaries
- Historical achievements

### reference/ (Technical specs)
- Patterns
- Performance fixes
- System specs

### archive/ (Historical)
- Superseded docs
- Old versions
- Deprecated content

---

## Next Steps

1. Read each file in `to_organize/`
2. Assign to appropriate bucket
3. Identify duplicates/overlaps
4. Synthesize each bucket into SSoT
5. Create master index
6. Archive superseded content
