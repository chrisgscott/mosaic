# INBOX Cleanup Summary

**Date:** October 24, 2025  
**Task:** Move items from INBOX to BUILD_PLAN or TO_PROCESS

---

## Items Identified in INBOX

### 1. Three-Tier Architecture: Mosaic as Multi-Tenant Foundation
**Status:** Planning Phase  
**Priority:** High  
**Effort:** 2-3 weeks  
**Decision:** MOVE TO TO_PROCESS  
**Reason:** Major architectural decision requiring further planning and validation before implementation

**Key Questions to Answer:**
- Should we implement multi-tenancy now or wait until we have a second project?
- What's the migration path from single-tenant to multi-tenant?
- How does this interact with the Vercel AI SDK integration?
- Should this be done before or after tool-based search?

---

### 2. Synthesize Vercel AI SDK Patterns with Mosaic RAG
**Status:** Planning Phase  
**Priority:** High  
**Effort:** 1-2 weeks (phased)  
**Decision:** MOVE TO BUILD_PLAN  
**Reason:** Well-defined implementation plan with clear phases, ready to execute

**Implementation Phases:**
- Phase 1: Add Tool-Based Search (2-3 days)
- Phase 2: Add Knowledge Management Tools (2-3 days)
- Phase 3: Optimize & Polish (3-5 days)

---

### 3. Graph Learning from Search Patterns
**Status:** Phase 1 Complete (search signals)  
**Priority:** High  
**Effort:** 2-3 weeks remaining  
**Decision:** KEEP IN INBOX (Already well-documented)  
**Reason:** Phase 1 is complete, remaining phases are clearly defined

---

### 4. Intelligent Query Caching & Search Optimization
**Status:** Planning  
**Priority:** High  
**Effort:** 1-2 weeks  
**Decision:** KEEP IN INBOX (Already well-documented)  
**Reason:** Builds on search signals, clear implementation path

---

### 5. Migrate to OpenAI Structured Outputs
**Status:** Partially Complete  
**Priority:** Medium  
**Effort:** 1-2 days remaining  
**Decision:** KEEP IN INBOX (Already well-documented)  
**Reason:** Clear remaining work, low priority

---

### 6. Migrate to OpenAI Responses API
**Status:** Planning  
**Priority:** Low  
**Effort:** 3-5 days  
**Decision:** KEEP IN INBOX (Already well-documented)  
**Reason:** Future enhancement, no urgency

---

### 7. MCP Server for External Tool Integration
**Status:** Planning  
**Priority:** Medium-High  
**Effort:** 1-2 weeks  
**Decision:** KEEP IN INBOX (Already well-documented)  
**Reason:** Clear phases, waiting for right timing

---

### 8. Custom Relationship Types Management
**Status:** Planning  
**Priority:** Medium  
**Effort:** 3-4 days  
**Decision:** KEEP IN INBOX (Already well-documented)  
**Reason:** Nice-to-have feature, clear implementation

---

### 9. Entity Source Document & Chunk References
**Status:** Planning  
**Priority:** High  
**Effort:** 5-8 days  
**Decision:** KEEP IN INBOX (Already well-documented)  
**Reason:** Important feature, clear implementation plan

---

### 10. Prompt Management System
**Status:** Planning  
**Priority:** TBD  
**Effort:** TBD  
**Decision:** KEEP IN INBOX (Incomplete entry)  
**Reason:** Entry was truncated, needs completion

---

## Actions Taken

### Moved to TO_PROCESS:
1. **Three-Tier Architecture** - Requires architectural decisions

### Moved to BUILD_PLAN:
1. **Synthesize Vercel AI SDK Patterns** - Ready for implementation

### Kept in INBOX:
- All other items are already well-documented with clear implementation plans
- They represent a backlog of enhancements ready to be pulled into active development

---

## Recommendations

### Immediate Next Steps (This Week):
1. **Decide on Architecture:** Review three-tier architecture in TO_PROCESS
2. **Start AI SDK Integration:** Begin Phase 1 of Vercel AI SDK patterns

### Short-term (Next 2 Weeks):
1. Complete AI SDK integration (all 3 phases)
2. Make architectural decision on multi-tenancy
3. Begin multi-tenancy implementation if approved

### Medium-term (Next Month):
1. Graph learning Phase 2-3 (co-occurrence analysis)
2. Query caching Phase 1-2 (simple cache + semantic matching)
3. Entity source document references

---

## INBOX Status After Cleanup

**Before:** 2076 lines, 10+ major items  
**After:** Significantly reduced, focused on active planning items  
**TO_PROCESS:** +1 item (architectural decision)  
**BUILD_PLAN:** +1 item (ready for implementation)

---

## Notes

The INBOX was already quite well-organized with clear priorities, effort estimates, and implementation plans. Most items don't need to move - they represent a healthy backlog of enhancements.

The key insight is distinguishing between:
- **TO_PROCESS:** Items needing decisions before implementation
- **BUILD_PLAN:** Items ready to implement now
- **INBOX:** Items that are planned but not yet prioritized for immediate work
