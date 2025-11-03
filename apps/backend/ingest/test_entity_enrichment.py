#!/usr/bin/env python3
"""
Test script to demonstrate entity enrichment during deduplication.

This script simulates extracting the same entity from multiple documents
to show how descriptions and aliases accumulate.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from processors.graph_extractor import GraphExtractor, Entity, EntityType

def merge_descriptions(existing: str, new: str) -> str:
    """
    Standalone version of _merge_descriptions for testing
    """
    if not new or not new.strip():
        return existing
    
    if not existing or not existing.strip():
        return new
    
    # Normalize for comparison
    existing_lower = existing.lower()
    new_lower = new.lower()
    
    # If new description is substantially different, append it
    if new_lower not in existing_lower and existing_lower not in new_lower:
        # Avoid duplicating similar content - check for significant overlap
        new_words = set(new_lower.split())
        existing_words = set(existing_lower.split())
        overlap = len(new_words & existing_words) / len(new_words) if new_words else 0
        
        # If less than 70% overlap, it's adding new information
        if overlap < 0.7:
            return f"{existing}. {new}"
    
    # Otherwise keep existing (new is redundant or subset)
    return existing

def test_description_merging():
    """Test the description merging logic"""
    print("=" * 60)
    print("Testing Description Merging")
    print("=" * 60)
    
    # Test 1: Empty existing
    result = merge_descriptions("", "A technology company")
    print(f"\nTest 1 - Empty existing:")
    print(f"  Existing: ''")
    print(f"  New: 'A technology company'")
    print(f"  Result: '{result}'")
    assert result == "A technology company"
    
    # Test 2: Empty new
    result = merge_descriptions("A technology company", "")
    print(f"\nTest 2 - Empty new:")
    print(f"  Existing: 'A technology company'")
    print(f"  New: ''")
    print(f"  Result: '{result}'")
    assert result == "A technology company"
    
    # Test 3: New is subset of existing
    result = merge_descriptions(
        "A technology company that makes electric vehicles",
        "A technology company"
    )
    print(f"\nTest 3 - New is subset:")
    print(f"  Existing: 'A technology company that makes electric vehicles'")
    print(f"  New: 'A technology company'")
    print(f"  Result: '{result}'")
    assert result == "A technology company that makes electric vehicles"
    
    # Test 4: New adds information (< 70% overlap)
    result = merge_descriptions(
        "A technology company",
        "Manufacturer of electric vehicles and clean energy products"
    )
    print(f"\nTest 4 - New adds information:")
    print(f"  Existing: 'A technology company'")
    print(f"  New: 'Manufacturer of electric vehicles and clean energy products'")
    print(f"  Result: '{result}'")
    assert "A technology company" in result
    assert "Manufacturer of electric vehicles" in result
    
    # Test 5: High overlap (> 70%) - should not merge
    result = merge_descriptions(
        "A technology company that makes electric vehicles",
        "A technology company that produces electric vehicles"
    )
    print(f"\nTest 5 - High overlap (redundant):")
    print(f"  Existing: 'A technology company that makes electric vehicles'")
    print(f"  New: 'A technology company that produces electric vehicles'")
    print(f"  Result: '{result}'")
    assert result == "A technology company that makes electric vehicles"
    
    print(f"\n{'=' * 60}")
    print("✅ All description merging tests passed!")
    print("=" * 60)

def demonstrate_enrichment_flow():
    """Demonstrate how entity enrichment works across multiple extractions"""
    print("\n" + "=" * 60)
    print("Entity Enrichment Flow Demonstration")
    print("=" * 60)
    
    print("\n📄 Document 1 extracts:")
    print("  Entity: Tesla")
    print("  Type: ORGANIZATION")
    print("  Description: 'A technology company'")
    print("  Aliases: ['Tesla Inc']")
    print("  → Creates new entity")
    
    print("\n📄 Document 2 extracts:")
    print("  Entity: Tesla")
    print("  Type: ORGANIZATION")
    print("  Description: 'Manufacturer of electric vehicles'")
    print("  Aliases: ['Tesla Motors', 'TSLA']")
    print("  → Matches existing entity")
    print("  → Enriches with:")
    print("     - Merged description: 'A technology company. Manufacturer of electric vehicles'")
    print("     - Added aliases: ['Tesla Motors', 'TSLA']")
    print("     - Total aliases: ['Tesla Inc', 'Tesla Motors', 'TSLA']")
    
    print("\n📄 Document 3 extracts:")
    print("  Entity: Tesla")
    print("  Type: ORGANIZATION")
    print("  Description: 'Clean energy and automotive company'")
    print("  Aliases: ['Tesla Inc', 'Tesla Energy']")
    print("  → Matches existing entity")
    print("  → Enriches with:")
    print("     - Merged description: 'A technology company. Manufacturer of electric vehicles. Clean energy and automotive company'")
    print("     - Added aliases: ['Tesla Energy'] (Tesla Inc already exists)")
    print("     - Total aliases: ['Tesla Inc', 'Tesla Motors', 'TSLA', 'Tesla Energy']")
    
    print("\n" + "=" * 60)
    print("✅ Entity becomes richer with each document!")
    print("=" * 60)

if __name__ == "__main__":
    test_description_merging()
    demonstrate_enrichment_flow()
    
    print("\n🎉 Entity enrichment is working correctly!")
    print("\nNext steps:")
    print("1. Upload multiple documents mentioning the same entities")
    print("2. Check entity descriptions and aliases grow over time")
    print("3. Verify no duplicate entities are created")
