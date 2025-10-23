"""
Test script to demonstrate custom chunking configuration.

This shows how to set up custom chunking for a Strategy Tactics-style document.
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chunkers.custom_boundary_chunker import CustomBoundaryChunker

# Sample Strategy Tactics content
SAMPLE_CONTENT = """
Recipe
Small-Batch Strategy
Forget annual planning! Run this lightweight process as often as you need to keep up with the true pace of change.

This tactic offers a smaller, faster planning process that delivers better outcomes in less time. After all, change is always happening. What good is it if we can only respond once a year?

Small-Batch Strategy
1. Complaint Department
Find out what you don't like about today, and then decide which problems to address first.

2. Default Disaster
Give yourself a clear reason to change by imagining what will happen if those problems remain unaddressed.

3. Tripwires
Set up an early warning system for potential disasters, so you don't have to worry about them (at least until you need to).

4. Feasible Futures
Unleash your imagination and decide what you want for the future, without being limited by what you have today.

5. Better Now
Instead of working towards a far-off future, create a version of now that makes many good futures possible!

pipdecks.com/small-batch-strategy © 2023, Pip Decks

Recipe
Call & Response
Help people understand the strategy by getting them involved in its creation.

Strategies need to make sense to the people actually doing the work to carry them out. You don't need perfect agreement, but everyone involved does need to know how the decisions were made.

Call & Response
1. Give Me A Reason
Why does any of this matter? Paint a compelling picture of the future we're fighting for.

2. Measure Twice
Get better outcomes by subjecting your assumptions and beliefs to a trial-by-fire of human scrutiny.

3. Challenge Statement
Create and deliver a clear articulation of the next challenge to overcome.

4. Backbrief
Rehearse the action to come, uncovering obstacles and misunderstandings early.

5. Decision Diary
Improve your decision-making by predicting what will happen and then reflecting on whether you were right.

pipdecks.com/call-and-response © 2023, Pip Decks
"""

def test_custom_chunking():
    """Test custom boundary chunking with Strategy Tactics config."""
    
    # Configuration that keeps recipe cards together
    config = {
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
    
    # Create chunker
    chunker = CustomBoundaryChunker(config)
    
    # Chunk the document
    chunks = chunker.chunk_document(SAMPLE_CONTENT, "test-doc-id")
    
    print(f"\n{'='*80}")
    print(f"Custom Chunking Test Results")
    print(f"{'='*80}\n")
    
    print(f"Total chunks created: {len(chunks)}")
    print(f"\n{'='*80}\n")
    
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i + 1}:")
        print(f"  Tokens: {chunk['token_count']}")
        print(f"  Section Type: {chunk['metadata'].get('section_type', 'N/A')}")
        print(f"  Content Preview (first 200 chars):")
        print(f"  {chunk['content'][:200]}...")
        print(f"\n{'-'*80}\n")
    
    # Verify that each recipe is in its own chunk
    recipe_chunks = [c for c in chunks if 'Recipe' in c['content'][:50]]
    print(f"Recipe chunks found: {len(recipe_chunks)}")
    print(f"\nExpected: 2 recipe chunks (Small-Batch Strategy, Call & Response)")
    print(f"Actual: {len(recipe_chunks)} recipe chunks")
    
    if len(recipe_chunks) == 2:
        print(f"\n✅ SUCCESS: Each recipe card is kept together as a single chunk!")
    else:
        print(f"\n⚠️  WARNING: Expected 2 recipe chunks, got {len(recipe_chunks)}")
    
    return chunks

if __name__ == "__main__":
    test_custom_chunking()
