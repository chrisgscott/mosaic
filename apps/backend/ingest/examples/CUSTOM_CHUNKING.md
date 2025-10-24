# Custom Chunking Configuration

Per-document chunking configuration allows you to fine-tune how documents are chunked based on their structure and semantics.

## Overview

Instead of using a one-size-fits-all chunking strategy, you can specify custom rules for each document that respect its logical structure. This is especially useful for:

- **Structured documents** (recipe cards, playbooks, manuals)
- **Documents with clear sections** (chapters, articles, guides)
- **Documents where context matters** (keeping related content together)

## How It Works

1. **Upload a document** to Mosaic
2. **Set the `chunking_config`** field on the document record
3. **Reprocess the document** - it will use your custom chunking rules

## Configuration Structure

```json
{
  "strategy": "custom_boundary",
  "boundary_markers": ["Recipe", "##", "Chapter"],
  "keep_together_patterns": [
    {
      "start_marker": "Recipe\n",
      "end_marker": "pipdecks.com",
      "description": "Keep recipe cards together"
    }
  ],
  "max_chunk_tokens": 512,
  "respect_headings": true
}
```

### Fields

- **`strategy`**: Chunking strategy to use
  - `"hybrid"` - Default Docling HybridChunker (respects document structure)
  - `"custom_boundary"` - Custom boundary-based chunking

- **`boundary_markers`**: List of strings that mark chunk boundaries
  - Example: `["Recipe", "##", "Chapter"]`
  - Used when no keep-together patterns are defined

- **`keep_together_patterns`**: Array of patterns that define sections to keep together
  - `start_marker`: String that marks the beginning of a section
  - `end_marker`: String that marks the end of a section
  - `description`: Human-readable description of what this pattern captures

- **`max_chunk_tokens`**: Maximum tokens per chunk (default: 512)
  - Sections larger than this will be split intelligently

- **`respect_headings`**: Whether to respect heading boundaries when splitting

## Example: Strategy Tactics Deck

For a document like Strategy Tactics where each "Recipe" card should stay together:

```json
{
  "strategy": "custom_boundary",
  "keep_together_patterns": [
    {
      "start_marker": "Recipe\n",
      "end_marker": "pipdecks.com",
      "description": "Keep recipe cards together"
    }
  ],
  "max_chunk_tokens": 512
}
```

This ensures that each recipe (like "Small-Batch Strategy", "Call & Response", etc.) stays together as a single chunk with its:
- Title
- Description
- All steps (1-5)
- Footer

## Setting the Configuration

### Via SQL

```sql
UPDATE documents
SET chunking_config = '{
  "strategy": "custom_boundary",
  "keep_together_patterns": [
    {
      "start_marker": "Recipe\\n",
      "end_marker": "pipdecks.com",
      "description": "Keep recipe cards together"
    }
  ],
  "max_chunk_tokens": 512
}'::jsonb
WHERE id = 'your-document-id';
```

### Via API (Future)

```javascript
await supabase
  .from('documents')
  .update({
    chunking_config: {
      strategy: 'custom_boundary',
      keep_together_patterns: [
        {
          start_marker: 'Recipe\n',
          end_marker: 'pipdecks.com',
          description: 'Keep recipe cards together'
        }
      ],
      max_chunk_tokens: 512
    }
  })
  .eq('id', documentId);
```

## Benefits

1. **Better semantic coherence** - Related content stays together
2. **Improved search results** - Queries return complete, meaningful chunks
3. **Flexible per-document** - Different documents can use different strategies
4. **Respects document structure** - Honors the author's intended organization

## Advanced Patterns

### Multiple Pattern Types

```json
{
  "strategy": "custom_boundary",
  "keep_together_patterns": [
    {
      "start_marker": "## Chapter",
      "end_marker": "## Chapter",
      "description": "Keep chapters together"
    },
    {
      "start_marker": "### Section",
      "end_marker": "### Section",
      "description": "Keep sections together"
    }
  ]
}
```

### Regex Markers (Future Enhancement)

```json
{
  "strategy": "custom_boundary",
  "keep_together_patterns": [
    {
      "start_marker_regex": "^Recipe\\s+\\d+:",
      "end_marker": "---",
      "description": "Numbered recipes"
    }
  ]
}
```

## Troubleshooting

### Chunks Too Large

If sections are consistently too large:
- Reduce `max_chunk_tokens`
- Add more granular `boundary_markers`
- Use nested patterns (chapter → section → subsection)

### Chunks Too Small

If chunks are too fragmented:
- Increase `max_chunk_tokens`
- Remove some `boundary_markers`
- Use broader `keep_together_patterns`

### Pattern Not Matching

- Check for exact string matches (whitespace matters!)
- Use `\n` for newlines in JSON
- Test patterns on a sample of your document first

## Future Enhancements

- [ ] Interactive chunking preview in UI
- [ ] Regex support for markers
- [ ] Template library for common document types
- [ ] Automatic pattern detection
- [ ] Chunk quality scoring
