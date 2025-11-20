# TRANSCOM Proposal Tool - Mosaic Integration Guide

**Project:** TRANSCOM Proposal AI Pre-Evaluator  
**Mosaic Version:** 1.0  
**Last Updated:** 2025-01-20

This guide explains how to integrate the TRANSCOM proposal evaluation tool with Mosaic's knowledge retrieval API.

---

## Quick Start

### What Mosaic Provides

Mosaic is your **knowledge librarian** for TRANSCOM documents. It:
- ✅ Searches TRANSCOM PWS, statements, policies semantically
- ✅ Returns relevant chunks with relevance scores (0-1)
- ✅ Has no opinion about what's "good" or "bad"

### What Your Tool Decides

Your TRANSCOM tool has **all the business logic**:
- ✅ What queries to send to Mosaic
- ✅ What scores mean "good coverage" vs "gap"
- ✅ How to calculate 1-5 proposal scores
- ✅ What recommendations to generate
- ✅ How to create optimized rewrites

**Mosaic provides data. Your tool provides intelligence.**

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────┐
│   TRANSCOM Proposal Tool (Python)                   │
│   /Users/chrisgscott/projects/proposal_tool         │
│                                                      │
│   Your Logic:                                       │
│   • Load PWS tasks, rubrics, terminology (JSON)     │
│   • Determine what to check                         │
│   • Query Mosaic for relevant data                  │
│   • Interpret scores and calculate coverage         │
│   • Apply rubric weights and deductions             │
│   • Generate recommendations via LLM                │
│   • Create optimized rewrites                       │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP API calls
                    │ X-API-Key: ...
                    ▼
┌─────────────────────────────────────────────────────┐
│   Mosaic Knowledge Base                             │
│   http://localhost:3000                             │
│                                                      │
│   Contains:                                         │
│   • TRANSCOM Congressional Statements               │
│   • PWS documents                                   │
│   • Mission Assurance policies                      │
│   • Strategic airlift requirements                  │
│   • Commander's key points                          │
│                                                      │
│   Returns: Chunks with relevance scores             │
└─────────────────────────────────────────────────────┘
```

---

## Setup

### 1. Get Your API Key

Your Mosaic API key is stored in the environment:

```bash
# In your TRANSCOM project .env file
MOSAIC_API_KEY=92fe319d3b739aa7904e9659534e8cf0f3afd9286650ba53abb470a0d652a87c
MOSAIC_BASE_URL=http://localhost:3000
```

### 2. Install HTTP Client

```bash
# Add to requirements.txt
requests>=2.31.0
```

### 3. Create Mosaic Client

```python
# src/mosaic_client.py
import requests
import os
from typing import List, Dict, Optional

class MosaicClient:
    """Client for Mosaic knowledge retrieval API"""
    
    def __init__(self, base_url: str = None, api_key: str = None):
        self.base_url = base_url or os.environ.get('MOSAIC_BASE_URL', 'http://localhost:3000')
        self.api_key = api_key or os.environ['MOSAIC_API_KEY']
    
    def search(
        self,
        query: str,
        match_count: int = 5,
        skip_hyde: bool = True,
        skip_multi_query: bool = True,
        skip_graph_search: bool = True,
        skip_reranking: bool = False,
    ) -> List[Dict]:
        """
        Search Mosaic knowledge base.
        
        Args:
            query: Natural language search query
            match_count: Number of results to return
            skip_hyde: Skip HyDE for faster searches (recommended)
            skip_multi_query: Skip multi-query for faster searches (recommended)
            skip_graph_search: Skip graph search for faster searches (recommended)
            skip_reranking: Skip reranking (NOT recommended - reduces quality)
        
        Returns:
            List of result dictionaries with 'content', 'rerank_score', etc.
        """
        response = requests.post(
            f'{self.base_url}/api/search',
            headers={
                'Content-Type': 'application/json',
                'X-API-Key': self.api_key,
            },
            json={
                'query': query,
                'match_count': match_count,
                'skip_hyde': skip_hyde,
                'skip_multi_query': skip_multi_query,
                'skip_graph_search': skip_graph_search,
                'skip_reranking': skip_reranking,
            },
            timeout=30,
        )
        
        response.raise_for_status()
        data = response.json()
        return data['results']
    
    def check_coverage(self, text: str, match_count: int = 3) -> List[Dict]:
        """
        Check if proposal text is covered by knowledge base.
        Returns top matching chunks.
        """
        return self.search(
            query=text,
            match_count=match_count,
            skip_hyde=True,
            skip_multi_query=True,
            skip_graph_search=True,
            skip_reranking=False,  # Keep reranking for accuracy
        )
```

---

## Use Cases

### Use Case 1: Check PWS Task Coverage

**Problem:** Does my proposal adequately address PWS task 1.3.1?

```python
# src/evaluator.py
from mosaic_client import MosaicClient

class ProposalEvaluator:
    def __init__(self, data):
        self.data = data
        self.mosaic = MosaicClient()
    
    def check_pws_coverage(self, proposal_text: str, pws_tasks: List[Dict]) -> List[Dict]:
        """
        Check if proposal covers required PWS tasks.
        
        Returns coverage results with YOUR scoring logic.
        """
        coverage_results = []
        
        for task in pws_tasks:
            # Ask Mosaic: "What content relates to this task?"
            chunks = self.mosaic.check_coverage(task['text'], match_count=3)
            
            # YOUR LOGIC: Interpret the scores
            if chunks:
                # Use rerank_score (more accurate) or fall back to similarity
                scores = [c.get('rerank_score', c.get('similarity', 0)) for c in chunks]
                avg_score = sum(scores) / len(scores)
                max_score = max(scores)
                
                # YOUR THRESHOLDS: Define what's "good"
                if max_score > 0.8:
                    status = "EXCELLENT"
                    deduction = 0.0
                elif max_score > 0.6:
                    status = "ADEQUATE"
                    deduction = 0.5
                else:
                    status = "GAP"
                    deduction = 1.0
                
                coverage_results.append({
                    'task_id': task['id'],
                    'task_text': task['text'],
                    'status': status,
                    'max_score': max_score,
                    'avg_score': avg_score,
                    'deduction': deduction,
                    'evidence': chunks[0]['content'][:200] if chunks else None,
                    'source': chunks[0]['document_name'] if chunks else None,
                })
            else:
                # No matches found - definite gap
                coverage_results.append({
                    'task_id': task['id'],
                    'task_text': task['text'],
                    'status': "MISSING",
                    'max_score': 0.0,
                    'avg_score': 0.0,
                    'deduction': 2.0,
                    'evidence': None,
                    'source': None,
                })
        
        return coverage_results
```

**Example output:**
```python
[
    {
        'task_id': '1.3.1',
        'task_text': 'Support strategic airlift operations',
        'status': 'EXCELLENT',
        'max_score': 0.92,
        'avg_score': 0.87,
        'deduction': 0.0,
        'evidence': 'Strategic airlift is a national asymmetric advantage...',
        'source': 'TRANSCOM_Statement_to_Congress.md'
    },
    {
        'task_id': '1.3.2',
        'task_text': 'Coordinate deployment support',
        'status': 'GAP',
        'max_score': 0.54,
        'avg_score': 0.48,
        'deduction': 1.0,
        'evidence': 'Deployment coordination requires...',
        'source': 'TRANSCOM_Operations_Guide.pdf'
    }
]
```

---

### Use Case 2: Validate Terminology

**Problem:** Is "MARPA" a valid TRANSCOM term?

```python
def validate_terminology(self, terms: List[str]) -> Dict[str, bool]:
    """
    Check if terms appear in TRANSCOM knowledge base.
    
    Returns dict of term -> is_valid
    """
    validation_results = {}
    
    for term in terms:
        # Ask Mosaic: "What content mentions this term?"
        chunks = self.mosaic.search(
            query=term,
            match_count=3,
            skip_hyde=True,
            skip_multi_query=True,
        )
        
        # YOUR LOGIC: What makes a term "valid"?
        if chunks:
            max_score = max(c.get('rerank_score', c.get('similarity', 0)) for c in chunks)
            # High score = term appears in authoritative docs
            validation_results[term] = max_score > 0.7
        else:
            validation_results[term] = False
    
    return validation_results
```

**Example:**
```python
validator.validate_terminology(['MARPA', 'TRANSCOM', 'FakeAcronym'])
# Returns: {'MARPA': True, 'TRANSCOM': True, 'FakeAcronym': False}
```

---

### Use Case 3: Find Related Concepts

**Problem:** What should I mention when discussing "Mission Assurance"?

```python
def get_related_concepts(self, concept: str, count: int = 5) -> List[str]:
    """
    Find concepts related to a given topic.
    Useful for generating recommendations.
    """
    # Ask Mosaic: "What's related to this concept?"
    chunks = self.mosaic.search(
        query=f"{concept} related concepts and requirements",
        match_count=count,
        skip_hyde=False,  # Use HyDE for better conceptual matches
        skip_multi_query=False,
    )
    
    # Extract key concepts from results
    related = []
    for chunk in chunks:
        # YOUR LOGIC: Extract concepts from chunk content
        # Could use NER, keyword extraction, etc.
        related.append({
            'concept': chunk['document_name'],
            'relevance': chunk.get('rerank_score', chunk.get('similarity')),
            'context': chunk['content'][:100]
        })
    
    return related
```

---

### Use Case 4: Generate Evidence-Based Recommendations

**Problem:** What should I add to improve my proposal?

```python
def generate_recommendations(self, gaps: List[Dict]) -> List[str]:
    """
    Generate recommendations based on coverage gaps.
    Uses Mosaic to find relevant content to suggest.
    """
    recommendations = []
    
    for gap in gaps:
        if gap['status'] in ['GAP', 'MISSING']:
            # Ask Mosaic: "What content addresses this gap?"
            chunks = self.mosaic.search(
                query=gap['task_text'],
                match_count=3,
            )
            
            if chunks:
                best_chunk = chunks[0]
                recommendations.append({
                    'task_id': gap['task_id'],
                    'issue': f"Missing coverage of: {gap['task_text']}",
                    'suggestion': f"Consider adding content about: {best_chunk['content'][:200]}...",
                    'source': best_chunk['document_name'],
                    'priority': 'HIGH' if gap['deduction'] > 1.0 else 'MEDIUM'
                })
    
    return recommendations
```

---

## Recommended Configuration

### For Proposal Evaluation (Fast + Accurate)

```python
mosaic.search(
    query=your_query,
    match_count=5,
    skip_hyde=True,           # Skip for speed
    skip_multi_query=True,    # Skip for speed
    skip_graph_search=True,   # Skip for speed
    skip_reranking=False,     # KEEP for accuracy
)
```

**Performance:** ~2 seconds per query  
**Quality:** High (reranking enabled)  
**Cost:** Low (only reranking API call)

---

## Score Interpretation Guide

### Rerank Scores (Primary - Use These)

| Score Range | Meaning | Action |
|-------------|---------|--------|
| 0.9 - 1.0 | Excellent match | Strong evidence of coverage |
| 0.7 - 0.9 | Good match | Adequate coverage |
| 0.5 - 0.7 | Moderate match | Weak coverage, potential gap |
| 0.0 - 0.5 | Poor match | Definite gap |

### Similarity Scores (Fallback)

| Score Range | Meaning | Action |
|-------------|---------|--------|
| 0.8 - 1.0 | Strong similarity | Good coverage |
| 0.6 - 0.8 | Moderate similarity | Adequate coverage |
| 0.4 - 0.6 | Weak similarity | Potential gap |
| 0.0 - 0.4 | No similarity | Definite gap |

**Always prefer `rerank_score` over `similarity` when available.**

---

## Example: Complete Evaluation Flow

```python
# src/cli.py
from mosaic_client import MosaicClient
from evaluator import ProposalEvaluator
from data_loader import load_data

def evaluate_proposal(subfactor: int, proposal_file: str):
    """Complete evaluation workflow using Mosaic"""
    
    # 1. Load your local data (PWS, rubrics, etc.)
    data = load_data()
    
    # 2. Load proposal text
    with open(proposal_file, 'r') as f:
        proposal_text = f.read()
    
    # 3. Initialize evaluator with Mosaic client
    evaluator = ProposalEvaluator(data)
    
    # 4. Get PWS tasks for this subfactor
    pws_tasks = data.get_pws_tasks_for_subfactor(subfactor)
    
    # 5. Check coverage using Mosaic
    print(f"Checking coverage of {len(pws_tasks)} PWS tasks...")
    coverage = evaluator.check_pws_coverage(proposal_text, pws_tasks)
    
    # 6. Calculate score (YOUR LOGIC)
    total_deductions = sum(c['deduction'] for c in coverage)
    final_score = max(1.0, 5.0 - total_deductions)
    
    # 7. Identify gaps
    gaps = [c for c in coverage if c['status'] in ['GAP', 'MISSING']]
    
    # 8. Generate recommendations
    recommendations = evaluator.generate_recommendations(gaps)
    
    # 9. Display results
    print(f"\n{'='*60}")
    print(f"PROPOSAL EVALUATION - SUBFACTOR {subfactor}")
    print(f"{'='*60}")
    print(f"\nFinal Score: {final_score:.1f}/5.0")
    print(f"Total Deductions: {total_deductions:.1f}")
    print(f"\nCoverage Summary:")
    print(f"  Excellent: {sum(1 for c in coverage if c['status'] == 'EXCELLENT')}")
    print(f"  Adequate:  {sum(1 for c in coverage if c['status'] == 'ADEQUATE')}")
    print(f"  Gaps:      {sum(1 for c in coverage if c['status'] == 'GAP')}")
    print(f"  Missing:   {sum(1 for c in coverage if c['status'] == 'MISSING')}")
    
    if gaps:
        print(f"\n{'='*60}")
        print(f"GAPS IDENTIFIED ({len(gaps)})")
        print(f"{'='*60}")
        for gap in gaps:
            print(f"\n❌ {gap['task_id']}: {gap['task_text']}")
            print(f"   Score: {gap['max_score']:.2f}")
            print(f"   Deduction: {gap['deduction']:.1f} points")
    
    if recommendations:
        print(f"\n{'='*60}")
        print(f"RECOMMENDATIONS ({len(recommendations)})")
        print(f"{'='*60}")
        for rec in recommendations:
            print(f"\n{rec['priority']}: {rec['issue']}")
            print(f"   {rec['suggestion']}")
            print(f"   Source: {rec['source']}")
    
    return {
        'score': final_score,
        'coverage': coverage,
        'gaps': gaps,
        'recommendations': recommendations
    }
```

---

## Testing Your Integration

### 1. Test Basic Search

```python
# test_mosaic.py
from mosaic_client import MosaicClient

mosaic = MosaicClient()

# Test search
results = mosaic.search("TRANSCOM strategic airlift requirements")

print(f"Found {len(results)} results")
for i, result in enumerate(results[:3], 1):
    score = result.get('rerank_score', result.get('similarity'))
    print(f"\n{i}. Score: {score:.3f}")
    print(f"   Doc: {result['document_name']}")
    print(f"   Content: {result['content'][:100]}...")
```

**Expected output:**
```
Found 5 results

1. Score: 0.988
   Doc: TRANSCOM_Statement_to_Congress.md
   Content: Strategic airlift is a national asymmetric advantage...

2. Score: 0.910
   Doc: TRANSCOM_Commander_s_Statement_Key_Points_VLM.md
   Content: Strategic Airlift: 52 C-5M, 223 C-17 fleet...
```

### 2. Test Coverage Check

```python
# Test PWS task coverage
task = {
    'id': '1.3.1',
    'text': 'Support strategic airlift operations and deployment coordination'
}

chunks = mosaic.check_coverage(task['text'], match_count=3)
max_score = max(c.get('rerank_score', 0) for c in chunks)

print(f"Task: {task['text']}")
print(f"Max Score: {max_score:.3f}")
print(f"Status: {'COVERED' if max_score > 0.7 else 'GAP'}")
```

---

## Error Handling

```python
import requests
from typing import Optional

class MosaicClient:
    def search(self, query: str, **kwargs) -> List[Dict]:
        """Search with error handling and retries"""
        max_retries = 3
        
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    f'{self.base_url}/api/search',
                    headers={
                        'Content-Type': 'application/json',
                        'X-API-Key': self.api_key,
                    },
                    json={'query': query, **kwargs},
                    timeout=30,
                )
                
                response.raise_for_status()
                return response.json()['results']
                
            except requests.exceptions.Timeout:
                print(f"Timeout on attempt {attempt + 1}/{max_retries}")
                if attempt == max_retries - 1:
                    raise
                    
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 401:
                    raise ValueError("Invalid API key")
                elif e.response.status_code == 500:
                    print(f"Server error on attempt {attempt + 1}/{max_retries}")
                    if attempt == max_retries - 1:
                        raise
                else:
                    raise
            
            # Exponential backoff
            time.sleep(2 ** attempt)
        
        return []
```

---

## Performance Tips

### 1. Batch Similar Queries

```python
# Instead of:
for task in pws_tasks:
    chunks = mosaic.search(task['text'])  # 10 separate API calls

# Consider grouping:
all_results = {}
for task in pws_tasks:
    all_results[task['id']] = mosaic.search(task['text'])
    time.sleep(0.1)  # Small delay between requests
```

### 2. Cache Results

```python
import json
from pathlib import Path

class CachedMosaicClient(MosaicClient):
    def __init__(self, *args, cache_dir='.mosaic_cache', **kwargs):
        super().__init__(*args, **kwargs)
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
    
    def search(self, query: str, **kwargs) -> List[Dict]:
        # Create cache key from query + params
        cache_key = hashlib.md5(
            f"{query}{json.dumps(kwargs, sort_keys=True)}".encode()
        ).hexdigest()
        cache_file = self.cache_dir / f"{cache_key}.json"
        
        # Check cache
        if cache_file.exists():
            with open(cache_file) as f:
                return json.load(f)
        
        # Call API
        results = super().search(query, **kwargs)
        
        # Save to cache
        with open(cache_file, 'w') as f:
            json.dump(results, f)
        
        return results
```

---

## Summary

### What You Need to Do

1. ✅ Copy `mosaic_client.py` to your project
2. ✅ Add `MOSAIC_API_KEY` to your `.env`
3. ✅ Integrate into your `evaluator.py`
4. ✅ Define YOUR thresholds and scoring logic
5. ✅ Test with real proposal text

### What Mosaic Does for You

- ✅ Searches TRANSCOM knowledge base
- ✅ Returns relevant chunks with scores
- ✅ Fast (~2 seconds) and accurate

### What You Control

- ✅ What queries to send
- ✅ What scores mean "good" vs "bad"
- ✅ How to calculate final scores
- ✅ What recommendations to generate

---

## Next Steps

1. **Test the integration:** Run `test_mosaic.py`
2. **Update your evaluator:** Add Mosaic search to `check_pws_coverage()`
3. **Define thresholds:** Decide what scores = EXCELLENT/ADEQUATE/GAP
4. **Run evaluation:** Test with real proposal text
5. **Iterate:** Adjust thresholds based on results

---

## Support

**API Documentation:** `/docs/API.md`  
**Mosaic Instance:** http://localhost:3000  
**Questions:** Ask in your TRANSCOM project workspace

**Remember:** Mosaic is your librarian. You're the expert evaluator. 🎯
