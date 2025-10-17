# Living Entity Update Workflow

## Overview

This document describes the complete end-to-end workflow for updating living entities when new content is ingested into the Mosaic platform.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Content Ingestion                                        │
│    - Document uploaded                                      │
│    - News article fetched                                   │
│    - Data imported                                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Standard Processing                                      │
│    - Chunking (Docling)                                     │
│    - Embedding generation                                   │
│    - Graph entity extraction                                │
│    - Storage in database                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Trigger Living Entity Update                            │
│    - Queue update job                                       │
│    - Pass content_id and content_type                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CrewAI Processing                                        │
│                                                              │
│    ┌──────────────────────────────────────────────────┐   │
│    │ Agent 1: Identifier                               │   │
│    │ → Identifies affected living entities            │   │
│    │ → Returns: [antimony, mp-materials, dla, ...]   │   │
│    └──────────────┬───────────────────────────────────┘   │
│                   │                                         │
│    ┌──────────────▼───────────────────────────────────┐   │
│    │ Agent 2: Extractor                                │   │
│    │ → Extracts info for each entity's template       │   │
│    │ → Returns: {section: content, confidence}        │   │
│    └──────────────┬───────────────────────────────────┘   │
│                   │                                         │
│    ┌──────────────▼───────────────────────────────────┐   │
│    │ Agent 3: Synthesizer                              │   │
│    │ → Merges with existing content                    │   │
│    │ → Returns: synthesized content                    │   │
│    └──────────────┬───────────────────────────────────┘   │
│                   │                                         │
│    ┌──────────────▼───────────────────────────────────┐   │
│    │ Agent 4: Linker                                   │   │
│    │ → Creates relationships between entities          │   │
│    │ → Returns: [{source, target, type, context}]     │   │
│    └──────────────┬───────────────────────────────────┘   │
│                   │                                         │
│    ┌──────────────▼───────────────────────────────────┐   │
│    │ Agent 5: Validator                                │   │
│    │ → Validates quality and accuracy                  │   │
│    │ → Returns: {status: approved/rejected}           │   │
│    └──────────────┬───────────────────────────────────┘   │
│                   │                                         │
└───────────────────┼─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Apply Updates (if approved)                             │
│    - Update living_entities table                          │
│    - Create/update relationships                           │
│    - Log to living_entity_updates                          │
│    - Update graph links                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Post-Update Actions                                     │
│    - Invalidate cache                                      │
│    - Notify watchers (optional)                            │
│    - Update search index                                   │
│    - Log metrics                                           │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Steps

### Step 1: Content Ingestion

Content enters the system through various channels:

**Document Upload:**
```typescript
// User uploads PDF/Word/etc
POST /api/documents
→ Document stored in Supabase Storage
→ Document record created in database
→ Enqueued for processing
```

**News Article Fetch:**
```typescript
// RSS feed or manual fetch
POST /api/news/fetch
→ Article content fetched
→ Article record created in database
→ Enqueued for processing
```

**Structured Data Import:**
```typescript
// CSV/Excel upload
POST /api/data/import
→ Data parsed and stored
→ Data record created in database
→ Enqueued for processing
```

### Step 2: Standard Processing

All content goes through standard Mosaic processing:

```python
async def process_content(content_id: str, content_type: str):
    """Standard processing pipeline"""
    
    # 1. Chunking (for documents)
    if content_type == 'document':
        chunks = await chunk_document(content_id)
        await store_chunks(chunks)
    
    # 2. Embedding generation
    embeddings = await generate_embeddings(content_id)
    await store_embeddings(embeddings)
    
    # 3. Graph entity extraction
    graph_entities = await extract_graph_entities(content_id)
    await store_graph_entities(graph_entities)
    
    # 4. Trigger living entity update
    await trigger_living_entity_update(content_id, content_type)
```

### Step 3: Trigger Living Entity Update

After standard processing completes, trigger the living entity update:

```python
async def trigger_living_entity_update(content_id: str, content_type: str):
    """Queue living entity update job"""
    
    # Add to background job queue
    await job_queue.enqueue(
        'living_entity_update',
        content_id=content_id,
        content_type=content_type,
        priority='normal'
    )
    
    logger.info(f"Queued living entity update for {content_type}:{content_id}")
```

### Step 4: CrewAI Processing

The CrewAI crew processes the content through 5 agents:

```python
async def execute_living_entity_update(content_id: str, content_type: str):
    """Execute the CrewAI update workflow"""
    
    # Prepare inputs
    inputs = {
        'content_id': content_id,
        'content_type': content_type,
        'organization_id': get_organization_id(),
        'timestamp': datetime.now().isoformat()
    }
    
    # Execute crew
    result = await living_entity_update_crew.kickoff_async(inputs=inputs)
    
    return result
```

**Agent Execution Flow:**

1. **Identifier Agent** identifies affected entities:
   ```python
   affected_entities = [
       {'slug': 'antimony', 'confidence': 0.95},
       {'slug': 'mp-materials', 'confidence': 0.95},
       {'slug': 'defense-logistics-agency', 'confidence': 0.90},
       {'slug': 'f-35', 'confidence': 0.85},
       {'slug': 'arizona-mine', 'confidence': 0.80}
   ]
   ```

2. **Extractor Agent** extracts information for each entity:
   ```python
   extractions = {
       'antimony': {
           'recent_developments': {
               'content': {...},
               'confidence': 0.95
           },
           'supply_chain': {
               'content': {...},
               'confidence': 0.90
           }
       },
       'mp-materials': {
           'recent_activity': {
               'content': {...},
               'confidence': 0.95
           }
       }
       # ... for each entity
   }
   ```

3. **Synthesizer Agent** merges with existing content:
   ```python
   synthesized = {
       'antimony': {
           'recent_developments': {
               'timeline': [
                   # New item added to timeline
                   {'date': '2025-10-16', 'title': '...', ...},
                   # Existing items preserved
                   ...
               ]
           }
       }
   }
   ```

4. **Linker Agent** creates relationships:
   ```python
   relationships = [
       {
           'source': 'mp-materials',
           'target': 'antimony',
           'type': 'produces',
           'context': 'MP Materials produces Antimony from Arizona mine',
           'strength': 0.95
       },
       # ... more relationships
   ]
   ```

5. **Validator Agent** validates quality:
   ```python
   validation = {
       'status': 'approved',
       'confidence': 0.95,
       'issues': [],
       'checks': {
           'factual_accuracy': 'pass',
           'source_credibility': 'pass',
           'schema_compliance': 'pass',
           'consistency': 'pass'
       }
   }
   ```

### Step 5: Apply Updates

If validation passes, apply the updates to the database:

```python
async def apply_entity_updates(result: CrewResult):
    """Apply approved updates to living entities"""
    
    for entity_slug, updates in result.entity_updates.items():
        # Get existing entity
        entity = await get_living_entity(entity_slug)
        
        # Apply section updates
        for section_name, section_update in updates.items():
            # Get update strategy from template
            template = templateRegistry.get(entity.entity_type)
            section_def = template.get_section(section_name)
            strategy = section_def.update_strategy
            
            # Apply update based on strategy
            if strategy == 'replace':
                entity.sections[section_name] = section_update.content
            elif strategy == 'merge':
                entity.sections[section_name] = merge_content(
                    entity.sections[section_name],
                    section_update.content
                )
            elif strategy == 'append':
                entity.sections[section_name] = append_content(
                    entity.sections[section_name],
                    section_update.content
                )
            
            # Log update
            await log_entity_update(
                entity_id=entity.id,
                section_name=section_name,
                update_type='modify',
                old_content=entity.sections[section_name],
                new_content=section_update.content,
                source_id=result.content_id,
                source_type=result.content_type,
                updated_by='crewai_agent',
                confidence=section_update.confidence
            )
        
        # Update metadata
        entity.last_updated = datetime.now()
        entity.update_count += 1
        entity.source_count += 1
        
        # Save entity
        await save_living_entity(entity)
        
        logger.info(f"Updated living entity: {entity_slug}")
    
    # Create/update relationships
    for rel in result.relationships:
        await create_or_update_relationship(
            source=rel.source,
            target=rel.target,
            type=rel.type,
            context=rel.context,
            strength=rel.strength,
            source_id=result.content_id,
            source_type=result.content_type
        )
        
        logger.info(f"Created relationship: {rel.source} -> {rel.target}")
```

### Step 6: Post-Update Actions

After updates are applied, perform cleanup and notifications:

```python
async def post_update_actions(entity_slugs: list[str]):
    """Actions to perform after updating entities"""
    
    # 1. Invalidate cache
    for slug in entity_slugs:
        await cache.invalidate(f"living_entity:{slug}")
    
    # 2. Update search index
    await search_index.reindex_entities(entity_slugs)
    
    # 3. Notify watchers (if enabled)
    for slug in entity_slugs:
        watchers = await get_entity_watchers(slug)
        for watcher in watchers:
            await notify_user(
                user_id=watcher.user_id,
                message=f"Entity '{slug}' has been updated",
                entity_slug=slug
            )
    
    # 4. Log metrics
    await metrics.increment('living_entities.updated', len(entity_slugs))
    await metrics.gauge('living_entities.total', await count_living_entities())
    
    logger.info(f"Post-update actions completed for {len(entity_slugs)} entities")
```

## Error Handling

### Validation Failures

If the validator rejects an update:

```python
if result.validation_status == 'rejected':
    # Log rejection
    await log_rejected_update(
        content_id=result.content_id,
        reason=result.validation_issues,
        confidence=result.confidence
    )
    
    # Store for manual review
    await store_for_manual_review(
        content_id=result.content_id,
        proposed_updates=result.entity_updates,
        rejection_reason=result.validation_issues
    )
    
    # Notify admin if confidence was high
    if result.confidence > 0.8:
        await notify_admin(
            f"High-confidence update rejected: {result.content_id}",
            details=result.validation_issues
        )
```

### Processing Failures

If the crew execution fails:

```python
try:
    result = await living_entity_update_crew.kickoff_async(inputs=inputs)
except Exception as e:
    logger.error(f"Crew execution failed: {e}", exc_info=True)
    
    # Store failure for retry
    await store_failed_job(
        job_type='living_entity_update',
        content_id=content_id,
        error=str(e),
        retry_count=0,
        max_retries=3
    )
    
    # Notify admin for critical failures
    if is_critical_content(content_id):
        await notify_admin(f"Critical content update failed: {content_id}")
```

### Retry Logic

Implement exponential backoff for retries:

```python
async def retry_failed_update(job_id: str):
    """Retry a failed living entity update"""
    
    job = await get_failed_job(job_id)
    
    if job.retry_count >= job.max_retries:
        logger.error(f"Max retries exceeded for job {job_id}")
        await mark_job_permanently_failed(job_id)
        return
    
    # Exponential backoff: 1min, 5min, 15min
    delay = 60 * (5 ** job.retry_count)
    
    await job_queue.enqueue(
        'living_entity_update',
        content_id=job.content_id,
        content_type=job.content_type,
        retry_count=job.retry_count + 1,
        delay=delay
    )
    
    logger.info(f"Scheduled retry {job.retry_count + 1} for job {job_id} in {delay}s")
```

## Performance Optimization

### Batch Processing

Process multiple content items in batches:

```python
async def batch_process_updates(content_ids: list[str]):
    """Process multiple content items efficiently"""
    
    # Group by content type
    by_type = defaultdict(list)
    for content_id in content_ids:
        content_type = await get_content_type(content_id)
        by_type[content_type].append(content_id)
    
    # Process each type in parallel
    tasks = []
    for content_type, ids in by_type.items():
        task = process_content_batch(ids, content_type)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks)
    
    return results
```

### Caching

Cache frequently accessed data:

```python
# Cache entity templates
@cache(ttl=3600)
async def get_entity_template(entity_type: str):
    return templateRegistry.get(entity_type)

# Cache living entities
@cache(ttl=300)
async def get_living_entity(slug: str):
    return await db.query(
        "SELECT * FROM living_entities WHERE slug = $1",
        slug
    )

# Cache relationships
@cache(ttl=300)
async def get_entity_relationships(entity_id: str):
    return await db.query(
        "SELECT * FROM living_entity_relationships WHERE source_entity_id = $1",
        entity_id
    )
```

### Parallel Agent Execution

For independent entities, process in parallel:

```python
async def process_multiple_entities(entities: list[str], content_id: str):
    """Process multiple entities in parallel"""
    
    tasks = []
    for entity_slug in entities:
        task = process_single_entity(entity_slug, content_id)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Handle any failures
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"Failed to process {entities[i]}: {result}")
    
    return results
```

## Monitoring

### Key Metrics

Track these metrics for monitoring:

```python
# Processing metrics
metrics.histogram('living_entities.update_duration', duration_ms)
metrics.counter('living_entities.updates_total', tags=['status:success'])
metrics.counter('living_entities.updates_total', tags=['status:failed'])

# Quality metrics
metrics.gauge('living_entities.avg_confidence', avg_confidence)
metrics.counter('living_entities.validation_rejected')

# Entity metrics
metrics.gauge('living_entities.total_count', total_entities)
metrics.gauge('living_entities.relationships_count', total_relationships)

# Content metrics
metrics.counter('living_entities.content_processed', tags=[f'type:{content_type}'])
```

### Logging

Structured logging for observability:

```python
logger.info(
    "Living entity update completed",
    extra={
        'content_id': content_id,
        'content_type': content_type,
        'entities_updated': len(entity_slugs),
        'relationships_created': len(relationships),
        'duration_ms': duration,
        'confidence': avg_confidence
    }
)
```

---

**Next:** Read `04_ui_components.md` to learn about the frontend components for displaying living entities.
