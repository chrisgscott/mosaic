"""
Test script to demonstrate agentic chunking for Strategy Tactics-style documents.

This shows how the AgenticChunker uses LLM to identify card boundaries
regardless of category labels (Purpose, Recipe, Identify, etc.)
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from chunkers.agentic_chunker import AgenticChunker
from openai import OpenAI

# Sample Strategy Tactics content with different category labels
SAMPLE_CONTENT = """
Purpose
Default Disaster
Imagine the catastrophic default future that awaits if you don't make any changes, and then make a plan to avoid it.

Sometimes it's hard to choose what to work on next. We're so busy just keeping up with today's problems that we can't see the monster we're being! Identify what kind of horrible disaster you already know is coming, and then escape your future!

Default Disaster
1. Imagine the worst-case scenario. What's the most terrible thing that could happen if you don't make any changes? Now, what's even worse?

2. Invite the group to complain: "What's wrong with what we're experiencing right now?" Capture the problems, not the sticky notes or a whiteboard.

3. Pick one problem, then ask everyone to imagine the immediately catastrophic consequences of experiencing that problem. If you can't imagine it, it's probably not a problem worth solving.

4. For the same problem, invite everyone to play the consequences out over time. What will happen if we're still experiencing this problem in 5 years? Eventually, which 'Now problems' will we regret ignoring the most?

5. Make a plan to address the most urgent-reducing problems. A Better Now, anyone? Say bye!

pipdecks.com/default-disaster © 2023, Pip Decks

Purpose
Better Now
Aim for the best possible today so you can make many different futures possible.

Instead of working towards a far-off future, create a version of now that makes many good futures possible! After all, the future is always changing. What good is it if we can only respond once a year?

Better Now
1. "How would we be different than what we have now?"

2. "Imagine the ideal version of now. What would be different?"

3. Ask the group to imagine a plan to get to the "better now." Have them consider the big-picture actions and place them in the center of the workspace.

4. "What would a 'better now' look like for us?"

5. "What signs would tell us we were planning poorly?"

6. Invite the group to a plan to get to the "better now." Have them consider the big-picture actions and place them in the center of the workspace.

pipdecks.com/better-now © 2023, Pip Decks

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
"""

def test_agentic_chunking():
    """Test agentic chunking with Strategy Tactics config."""
    
    # Configuration for card deck with variable category labels
    config = {
        "strategy": "agentic",
        "model": "gpt-4o-mini",
        "max_chunk_tokens": 512,
        "document_type": "card_deck",
        "instructions": """This is a Strategy Tactics card deck where each card represents a complete tactic or concept.

Each card has:
- A category label at the top (e.g., 'Purpose', 'Recipe', 'Identify', 'Connect', 'Evolve', 'Adapt', 'Plays', 'Lead')
- A title (e.g., 'Default Disaster', 'Better Now', 'Small-Batch Strategy')
- A description paragraph
- Numbered steps (usually 1-5)
- A footer with URL and copyright (e.g., 'pipdecks.com/...')

Your task: Identify the boundaries of each card so that each card becomes a single chunk. Cards should be kept together as complete semantic units, regardless of which category they belong to.

Look for:
- Category labels followed by titles
- Numbered step sequences
- Footer markers (pipdecks.com)
- Visual/layout breaks between cards"""
    }
    
    # Create chunker
    print("\n" + "="*80)
    print("Agentic Chunking Test - Strategy Tactics Card Deck")
    print("="*80 + "\n")
    
    print("Initializing AgenticChunker...")
    chunker = AgenticChunker(config, openai_client=OpenAI())
    
    print("Analyzing document structure and identifying card boundaries...")
    print("(This will make LLM calls to analyze the content)\n")
    
    # Chunk the document
    chunks = chunker.chunk_document(SAMPLE_CONTENT, "test-doc-id")
    
    print("\n" + "="*80)
    print(f"Chunking Results")
    print("="*80 + "\n")
    
    print(f"Total chunks created: {len(chunks)}")
    print(f"Expected: 3 cards (Default Disaster, Better Now, Small-Batch Strategy)")
    print(f"\n" + "="*80 + "\n")
    
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i + 1}:")
        print(f"  Tokens: {chunk['token_count']}")
        print(f"  Boundary Type: {chunk['metadata'].get('boundary_type', 'N/A')}")
        print(f"  Description: {chunk['metadata'].get('boundary_description', 'N/A')}")
        
        # Extract card title from content
        lines = chunk['content'].split('\n')
        title_line = lines[1] if len(lines) > 1 else "Unknown"
        print(f"  Card Title: {title_line}")
        
        print(f"  Content Preview (first 150 chars):")
        print(f"  {chunk['content'][:150]}...")
        print(f"\n" + "-"*80 + "\n")
    
    # Verify each card is its own chunk
    card_titles = ["Default Disaster", "Better Now", "Small-Batch Strategy"]
    found_cards = []
    
    for chunk in chunks:
        for title in card_titles:
            if title in chunk['content']:
                found_cards.append(title)
                break
    
    print(f"Cards found as separate chunks: {len(found_cards)}/{len(card_titles)}")
    print(f"Found: {', '.join(found_cards)}")
    
    if len(found_cards) == len(card_titles):
        print(f"\n✅ SUCCESS: Each card is kept together as a single chunk!")
        print(f"✅ Agentic chunking correctly identified card boundaries despite different category labels!")
    else:
        print(f"\n⚠️  Partial success: Found {len(found_cards)}/{len(card_titles)} cards")
    
    return chunks

if __name__ == "__main__":
    # Check for OpenAI API key
    if not os.getenv('OPENAI_API_KEY'):
        print("ERROR: OPENAI_API_KEY environment variable not set")
        print("Please set it before running this test")
        sys.exit(1)
    
    test_agentic_chunking()
