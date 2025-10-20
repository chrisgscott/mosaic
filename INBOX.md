# INBOX

## 💡 Enhancements & Ideas

### Chat Session Persistence & History
**Priority:** High  
**Effort:** 3-5 days  
**Phase:** 6.5.3 - Conversation Features

**Current State:**
- Chat conversations exist only in browser memory
- Refreshing the page clears all conversation history
- No way to revisit or continue previous conversations
- Users lose context when navigating away

**Required Implementation:**
1. **Database Schema:**
   - `chat_sessions` table: session metadata (title, created_at, updated_at, user_id)
   - `chat_messages` table: individual messages (session_id, role, content, sources, timestamp)
   - Auto-generate session titles from first message or conversation summary

2. **Session Management:**
   - Create new session on first message
   - Save each message (user + assistant) to database
   - Load session history when revisiting
   - List all user's sessions with preview/search
   - Delete/archive old sessions

3. **UI Components:**
   - Session sidebar/dropdown to switch between conversations
   - "New Chat" button to start fresh session
   - Session list with timestamps and previews
   - Search across all sessions
   - Export conversation functionality

4. **Conversation Continuity:**
   - Load full conversation history when opening session
   - Apply 10-turn limit only to what's sent to LLM (not what's displayed)
   - Show full conversation in UI, but send limited context to API
   - Preserve source citations and metadata

5. **Performance Considerations:**
   - Paginate long conversations
   - Lazy load old messages
   - Index sessions by user_id and timestamp
   - Consider conversation summarization for very long threads

**Benefits:**
- Users can return to conversations anytime
- Build knowledge over multiple sessions
- Reference previous answers
- Share conversation links (optional)
- Track conversation quality over time

**Related:**
- Phase 6.5.2: Context window management (conversation summarization)
- Phase 6.5.4: Analytics (track conversation metrics)

**Notes:**
- This is a critical feature for production use
- Without persistence, chat is just a demo
- Consider privacy/data retention policies
- May want conversation sharing/collaboration features later

---

## 🐛 Bugs & Issues

*No items pending - INBOX is clean!*

---

## ✅ Recently Completed

### Moved to BUILD_PLAN.md (October 19, 2025 - Evening)
- **Adaptive Response Depth & Retrieval Matching** → Phase 6.5 Enhancements
  - Quick/Standard/Detailed response modes
  - Deep Research Mode with CrewAI + o4-mini-deep-research
- **Kibo UI Component Library Evaluation** → Phase 12: Polish & Production Readiness

### Moved to BUILD_PLAN.md (October 19, 2025 - Morning)
All major enhancement proposals migrated to **Phase 10: Advanced Graph & Document Intelligence**:

1. **Entity Deduplication & Merge Assistant** → Phase 10.1 (High Priority, 1-2 weeks)
   - Manual merge workflow
   - Automated duplicate detection
   - AI-assisted merge intelligence

2. **Generic Entity Detection & Cleanup** → Phase 10.2 (Medium Priority, 3-4 days)
   - Detection & flagging of generic entities
   - Review & cleanup UI

3. **Document Organization System** → Phase 10.3 (Medium-High Priority, 1-2 weeks)
   - Folder/subfolder hierarchy
   - Tagging system
   - AI-powered organization suggestions

4. **Document-Level Intelligence & Graph Integration** → Phase 10.4 (High Priority, 2-3 weeks)
   - Document summarization & metadata
   - Auto-tagging from content
   - Documents as graph entities
   - Staleness detection & freshness tracking
   - Document clustering & discovery

5. **Temporal Data Management & Versioning** → Phase 10.5 (Medium-High Priority, 1 week)
   - Basic temporal metadata
   - Document versioning
   - Temporal search weighting

6. **Intelligent Source Discovery** → Phase 10.6 (Medium-High Priority, 1-2 weeks)
   - Knowledge gap analysis
   - Web source discovery
   - Automated source ingestion

7. **Adaptive Chunk Quality Enhancement** → Phase 10.7 (Medium-High Priority, 1-2 weeks)
   - Automatic quality detection
   - Selective LLM post-processing
   - On-demand re-chunking UI

8. **OCR Cleanup Pre-Processing** → Phase 10.8 (Medium Priority, 1 week)
   - Scanned document detection
   - Conservative OCR cleanup
   - Verification & rollback
   - UI & user control

9. **Prompt Management System** → Phase 10.9 (Medium Priority, 1 week)
   - Prompt settings page
   - Database-driven prompt management
   - Version tracking

### Moved to BUILD_PLAN.md (October 17, 2025)
- **Living Entities** → Phase 9 (4-6 weeks)
  - Template-based entity pages
  - CrewAI update crew
  - UI components
  - Integration with ingestion pipeline

### Previous Moves (October 17, 2025)
- **Entity & Relationship Description Synthesis** → Phase 5.7: Enterprise Graph Architecture
- **Corpus-Level Entity Management** → Phase 5.4: Graph Management UI (approach chosen)
- **Two-Level Graph Architecture** → Phase 5.7: Enterprise Graph Architecture  
- **Hierarchical Graph Traversal** → Phase 6 Enhancements

### Previous Moves (October 16, 2025)
- **HyDE Query Enhancement Tuning** → Phase 6 Enhancements (Medium Priority)
- **Graph Extractor Entity Quality Improvement** → Phase 6 Enhancements (Medium Priority)
- **PGMQ Queue State Corruption Fix** → Phase 6 Enhancements (High Priority)

### Previous Migrations (January 16, 2025)
- **Docling Native Chunking (HybridChunker)** → Phase 4 enhancement
- **OpenAI API Timeout Handling** → Phase 3 improvements
- Frontend Display Issues → TO_PROCESS.md
- Infrastructure Cleanup → TO_PROCESS.md
- Advanced RAG Patterns → TO_PROCESS.md
- Operational Decisions → TO_PROCESS.md

### Already Implemented (Removed from INBOX)
- Docling with VLM ✅ Deployed and working
- Parallel Page Processing ✅ Implemented in Docling processor

---

## How to Use This File

When new ideas or enhancements come up:

1. **Add them here first** - Quick capture without overthinking
2. **Run /cleanup workflow** - Periodically move items to BUILD_PLAN or TO_PROCESS
3. **Keep it clean** - INBOX should be empty or near-empty most of the time

---

*Last cleaned: October 19, 2025 (Evening)*
