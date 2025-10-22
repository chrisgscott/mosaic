# Prompt Management System

## 🎯 Overview

Centralized prompt management system that allows customizing all AI prompts from the UI. Prompts are stored in the database and can be edited without code changes.

## ✅ What Was Implemented

### **1. Database Schema**
- Added 8 prompts to `system_settings` table with category `'prompts'`
- Each prompt stored as JSON string with description
- Migration: `20251021_add_prompt_settings.sql`

### **2. Prompt Library** (`lib/ai/prompts.ts`)
- `getPrompt(key, variables)` - Get prompt with placeholder substitution
- `getAllPrompts()` - Get all prompts for settings page
- Default prompts as fallback if database unavailable
- Metadata for each prompt (title, description, placeholders, usage)

### **3. Settings Page** (`/settings/prompts`)
- Visual editor for all prompts
- Shows metadata (description, placeholders, usage)
- Save changes button
- Reset to defaults button
- Info tooltips for each prompt

### **4. Integration**
- Chat route updated to use `getPrompt('chat', { context })`
- All other routes ready to be updated similarly
- Sidebar navigation updated with Settings > Prompts

## 📋 Available Prompts

| Key | Title | Placeholders | Used In |
|-----|-------|--------------|---------|
| `chat` | Chat System Prompt | `{context}` | Chat interface, Q&A |
| `entityExtraction` | Entity Extraction | `{text}` | Document processing, Knowledge graph |
| `entityDescription` | Entity Description | - | Entity creation |
| `relationshipDescription` | Relationship Description | - | Relationship creation |
| `entityMerge` | Entity Merge | - | Entity deduplication |
| `entitySynthesis` | Entity Synthesis | - | Description merging |
| `hyde` | HyDE Generation | `{query}` | Search enhancement |
| `multiQuery` | Multi-Query Generation | `{query}` | Search enhancement |

## 🔧 How to Use

### **In Code:**

```typescript
import { getPrompt } from '@/lib/ai/prompts';

// Simple prompt (no variables)
const prompt = await getPrompt('entityDescription');

// Prompt with variables
const prompt = await getPrompt('chat', { 
  context: 'Retrieved document content...' 
});

// Prompt with multiple variables
const prompt = await getPrompt('hyde', { 
  query: 'What is RAG?' 
});
```

### **In UI:**
1. Navigate to **Settings > Prompts**
2. Edit any prompt in the textarea
3. Use placeholders like `{context}`, `{text}`, `{query}`
4. Click **Save Changes**
5. Changes take effect immediately

## 📝 Placeholder System

Prompts support variable substitution using `{placeholder}` syntax:

- `{context}` - Retrieved document content (chat)
- `{text}` - Text to analyze (entity extraction)
- `{query}` - User's search query (HyDE, multi-query)

Example:
```
Original: "Question: {query}\n\nAnswer this question..."
After:    "Question: What is RAG?\n\nAnswer this question..."
```

## 🔄 Migration Path

### **Files That Need Updating:**

1. ✅ **`app/api/chat/route.ts`** - Already updated
2. ⏳ **`lib/graph/entity-extraction.ts`** - Use `getPrompt('entityExtraction', { text })`
3. ⏳ **`app/api/ai/generate-description/route.ts`** - Use `getPrompt('entityDescription')` or `getPrompt('relationshipDescription')`
4. ⏳ **`app/api/ai/generate-merge-suggestion/route.ts`** - Use `getPrompt('entityMerge')`
5. ⏳ **`app/api/ai/synthesize-description/route.ts`** - Use `getPrompt('entitySynthesis')`
6. ⏳ **`app/api/search/route.ts`** - Use `getPrompt('hyde', { query })` and `getPrompt('multiQuery', { query })`
7. ⏳ **`apps/backend/ingest/processors/graph_extractor.py`** - Add settings service integration

### **Update Pattern:**

**Before:**
```typescript
const systemPrompt = `You are a helpful AI assistant...`;
```

**After:**
```typescript
import { getPrompt } from '@/lib/ai/prompts';

const systemPrompt = await getPrompt('chat', { context });
```

## 🎨 UI Features

### **Prompt Editor:**
- Large textarea for comfortable editing
- Monospace font for better readability
- Placeholder hints below each field
- Character count (future enhancement)

### **Metadata Display:**
- Info icon with tooltip
- Shows description, placeholders, and usage
- Helps users understand what each prompt does

### **Actions:**
- **Save Changes** - Updates database immediately
- **Reset to Defaults** - Restores original prompts (with confirmation)

## 🔒 Security

- ✅ Authentication required (checks `user` from Supabase)
- ✅ Prompts stored as JSON strings (escaped properly)
- ✅ No SQL injection risk (uses Supabase client)
- ✅ Graceful fallback to defaults if database unavailable

## 📊 Benefits

### **For Developers:**
- ✅ No code changes to update prompts
- ✅ Centralized prompt management
- ✅ Type-safe with TypeScript
- ✅ Easy to add new prompts

### **For Users:**
- ✅ Customize AI behavior without technical knowledge
- ✅ A/B test different prompts
- ✅ Quickly iterate on prompt engineering
- ✅ Reset to defaults if something breaks

### **For Operations:**
- ✅ Audit trail (updated_at timestamp)
- ✅ Version control friendly (migration file)
- ✅ Easy to backup/restore
- ✅ No deployment needed for prompt changes

## 🚀 Future Enhancements

1. **Prompt Versioning** - Track prompt history
2. **Prompt Templates** - Pre-built prompts for common use cases
3. **Prompt Testing** - Test prompts before saving
4. **Prompt Analytics** - Track which prompts perform best
5. **Multi-language** - Support prompts in different languages
6. **Prompt Variables UI** - Visual editor for placeholders
7. **Prompt Sharing** - Export/import prompts between instances

## 📁 Files Created

- `supabase/migrations/20251021_add_prompt_settings.sql` - Database migration
- `lib/ai/prompts.ts` - Prompt utility functions
- `app/(app)/settings/prompts/page.tsx` - Settings page
- `app/(app)/settings/prompts/prompts-form.tsx` - Form component
- `app/api/settings/reset-prompts/route.ts` - Reset API endpoint
- `PROMPT_MANAGEMENT_SYSTEM.md` - This documentation

## 📁 Files Modified

- `components/app-sidebar.tsx` - Added Prompts to Settings menu
- `app/api/chat/route.ts` - Updated to use `getPrompt()`

## 🧪 Testing Checklist

- [ ] Navigate to `/settings/prompts`
- [ ] Verify all 8 prompts are displayed
- [ ] Edit a prompt and save
- [ ] Verify change persists after page reload
- [ ] Test chat with custom prompt
- [ ] Click "Reset to Defaults"
- [ ] Verify prompts are restored
- [ ] Test with database unavailable (should use defaults)
- [ ] Verify placeholders are substituted correctly

## 🎊 Status

**Date:** October 21, 2025  
**Status:** ✅ Core system complete, ready for full integration  
**Prompts:** 8 prompts configured  
**Integration:** 1/7 routes updated (chat)  
**Next:** Update remaining routes to use prompt system

---

**Ready to use!** The prompt management system is fully functional. Update the remaining routes at your convenience.
