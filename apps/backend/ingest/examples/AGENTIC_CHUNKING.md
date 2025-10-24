# Agentic Chunking

**Agentic chunking uses LLM to intelligently identify semantic boundaries in documents**, creating chunks that respect the document's logical structure regardless of formatting variations.

## Why Agentic Chunking?

Traditional chunking strategies fail when:
- **Headings are contextual** (e.g., "Purpose", "Recipe", "Identify" - they're categories, not structure)
- **Layout varies** (multi-column, cards, mixed formats)
- **Semantic units don't match formatting** (a "card" might not have consistent markers)

Agentic chunking solves this by:
1. **Understanding document structure semantically** (not just pattern matching)
2. **Identifying logical boundaries** (card edges, topic shifts, concept completeness)
3. **Adapting to document type** (card decks, manuals, articles, etc.)

## How It Works

### Step 1: Structure Analysis
The LLM analyzes a sample of the document to understand:
- Document type (card deck, manual, article, etc.)
- Primary organizational structure (cards, chapters, sections)
- Repeating patterns
- Section markers

### Step 2: Boundary Identification
For each segment of the document, the LLM identifies:
- Where chunks should start/end
- What type of boundary it is (card_start, topic_change, etc.)
- Description of what's at that boundary

### Step 3: Chunk Extraction
Chunks are extracted based on identified boundaries:
- Semantic units kept together
- Large sections split intelligently at paragraph boundaries
- Metadata preserved (boundary type, description)

## Configuration

```json
{
  "strategy": "agentic",
  "model": "gpt-4o-mini",
  "max_chunk_tokens": 512,
  "document_type": "card_deck",
  "instructions": "Custom instructions for this document type..."
}
```

### Fields

- **`strategy`**: Must be `"agentic"`
- **`model`**: LLM model to use (default: `"gpt-4o-mini"`)
  - `"gpt-4o-mini"` - Fast and cost-effective
  - `"gpt-4o"` - More accurate for complex documents
- **`max_chunk_tokens`**: Maximum tokens per chunk (default: 512)
- **`document_type`**: Type hint for the LLM
  - `"card_deck"` - Card-based documents (like Strategy Tactics)
  - `"manual"` - Technical manuals
  - `"article"` - Articles or blog posts
  - `"reference"` - Reference documentation
  - `"general"` - General documents
- **`instructions`**: Custom instructions for the LLM (optional)
  - Describe the document structure
  - Explain what constitutes a semantic unit
  - Provide examples of boundaries

## Example: Strategy Tactics Card Deck

### The Problem
Strategy Tactics cards have **variable category labels**:
- Some cards are labeled "Purpose" (Default Disaster, Better Now)
- Some are labeled "Recipe" (Small-Batch Strategy, Call & Response)
- Others are "Identify", "Connect", "Evolve", "Adapt", "Plays", "Lead"

**Pattern matching fails** because the category label changes, but the card structure is consistent.

### The Solution

```json
{
  "strategy": "agentic",
  "model": "gpt-4o-mini",
  "max_chunk_tokens": 512,
  "document_type": "card_deck",
  "instructions": "This is a Strategy Tactics card deck where each card represents a complete tactic or concept.\n\nEach card has:\n- A category label at the top (e.g., 'Purpose', 'Recipe', 'Identify')\n- A title (e.g., 'Default Disaster', 'Better Now')\n- A description paragraph\n- Numbered steps (usually 1-5)\n- A footer with URL and copyright (e.g., 'pipdecks.com/...')\n\nYour task: Identify the boundaries of each card so that each card becomes a single chunk. Cards should be kept together as complete semantic units, regardless of which category they belong to."
}
```

### Result
Each card becomes one chunk:
- ✅ "Default Disaster" (Purpose) → 1 chunk
- ✅ "Better Now" (Purpose) → 1 chunk  
- ✅ "Small-Batch Strategy" (Recipe) → 1 chunk
- ✅ "Call & Response" (Recipe) → 1 chunk

**The LLM understands** that despite different category labels, each card is a semantic unit.

## Setting Up Agentic Chunking

### 1. Via SQL (Before Upload)

```sql
UPDATE documents
SET chunking_config = '{
  "strategy": "agentic",
  "model": "gpt-4o-mini",
  "document_type": "card_deck",
  "instructions": "..."
}'::jsonb
WHERE id = 'your-document-id';
```

### 2. Via API (Future)

```javascript
await supabase
  .from('documents')
  .update({
    chunking_config: {
      strategy: 'agentic',
      model: 'gpt-4o-mini',
      document_type: 'card_deck',
      instructions: '...'
    }
  })
  .eq('id', documentId);
```

### 3. As Default for Document Type

You could set this as the default for all card deck uploads by detecting the document type during upload.

## Cost Considerations

Agentic chunking makes LLM API calls:
- **Structure analysis**: 1 call per document (~$0.001 with gpt-4o-mini)
- **Boundary identification**: 1 call per ~4000 chars (~$0.001-0.003 per call)

For a 113-page document:
- ~30 API calls for boundary identification
- Total cost: ~$0.03-0.10 with gpt-4o-mini
- **Much cheaper than re-processing bad chunks!**

## Benefits

1. **Semantic coherence** - Chunks respect logical boundaries
2. **Handles variation** - Works with inconsistent formatting
3. **Document-aware** - Adapts to document type
4. **One-time cost** - Get it right during ingestion
5. **Better search** - Queries return complete, meaningful chunks
6. **Better graph extraction** - Entities/relationships extracted from coherent units

## Comparison

| Strategy | Best For | Pros | Cons |
|----------|----------|------|------|
| **Hybrid** (default) | General documents | Fast, reliable, structure-aware | May split semantic units |
| **Custom Boundary** | Consistent patterns | Fast, no LLM cost | Requires exact pattern matching |
| **Agentic** | Variable structure | Semantic understanding, adaptive | Small LLM cost, slower |

## Testing

Run the test script to see agentic chunking in action:

```bash
cd apps/backend/ingest
python examples/test_agentic_chunking.py
```

This will:
1. Analyze the sample Strategy Tactics content
2. Identify card boundaries
3. Create semantically coherent chunks
4. Show you the results

## Future Enhancements

- [ ] Caching of structure analysis for similar documents
- [ ] Automatic document type detection
- [ ] Template library for common document types
- [ ] Hybrid approach (agentic for structure, fast for content)
- [ ] Quality scoring of chunk boundaries
- [ ] Interactive boundary adjustment in UI
