"""
Test chunk size analysis in Sorting Hat.

Tests the heuristic-based chunk size optimization that determines
optimal chunk sizes (128, 256, 512, 1024) based on document characteristics.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from chunkers.sorting_hat import SortingHat


# Mock OpenAI client for testing (no API calls needed for chunk size analysis)
class MockMessage:
    content = '{"document_type": "manual", "structure_type": "hierarchical", "recommended_strategy": "hybrid", "reasoning": "Well-structured documentation", "confidence": "high"}'

class MockChoice:
    message = MockMessage()

class MockChatCompletions:
    choices = [MockChoice()]

class MockChat:
    def __init__(self):
        self.completions = self
    
    def create(self, **kwargs):
        return MockChatCompletions()

class MockOpenAI:
    def __init__(self):
        self.chat = MockChat()


def test_dense_technical_content():
    """Test that dense technical content gets small chunks (128 tokens)."""
    content = """
    API endpoint: /v1/users
    HTTP method: GET
    Auth: Bearer token
    Response: JSON
    Status codes: 200, 401, 404
    Rate limit: 100 req/min
    TTL: 3600s
    Cache: Redis
    DB: PostgreSQL
    ORM: Prisma
    """
    
    hat = SortingHat(openai_client=MockOpenAI())
    analysis = hat._analyze_chunk_size(content)
    
    print("\n=== Dense Technical Content ===")
    print(f"Optimal size: {analysis['optimal_size']}")
    print(f"Reasoning: {analysis['reasoning']}")
    print(f"Confidence: {analysis['confidence']}")
    print(f"Metrics: {analysis['metrics']}")
    
    assert analysis['optimal_size'] == 128, "Dense technical content should use 128 token chunks"
    assert analysis['confidence'] >= 0.8, "Should have high confidence"


def test_well_structured_content():
    """Test that well-structured content gets medium chunks (256 tokens)."""
    content = """
# Introduction

This document describes the architecture of our system.

## Components

The system consists of several key components:

- Frontend: React application
- Backend: Node.js API server
- Database: PostgreSQL
- Cache: Redis

## Data Flow

1. User makes request
2. Frontend sends to API
3. API queries database
4. Results cached in Redis
5. Response returned to user

## Security

All requests must be authenticated using JWT tokens.
"""
    
    hat = SortingHat(openai_client=MockOpenAI())
    analysis = hat._analyze_chunk_size(content)
    
    print("\n=== Well-Structured Content ===")
    print(f"Optimal size: {analysis['optimal_size']}")
    print(f"Reasoning: {analysis['reasoning']}")
    print(f"Confidence: {analysis['confidence']}")
    print(f"Metrics: {analysis['metrics']}")
    
    assert analysis['optimal_size'] == 256, "Well-structured content should use 256 token chunks"
    assert analysis['confidence'] >= 0.7, "Should have good confidence"


def test_long_form_narrative():
    """Test that long-form narrative gets large chunks (512 tokens)."""
    content = """
The history of artificial intelligence is a fascinating journey that spans several decades. 
It began in the 1950s when researchers first started exploring the possibility of creating 
machines that could think and learn like humans. The field has gone through several periods 
of excitement and disappointment, often referred to as AI winters and summers.

In the early days, researchers were optimistic about the potential of AI. They believed that 
within a few decades, machines would be able to perform any intellectual task that a human 
could do. However, they soon discovered that many problems were much harder than they initially 
thought. Simple tasks that humans perform effortlessly, like recognizing faces or understanding 
natural language, turned out to be incredibly complex for machines.

The development of neural networks in the 1980s marked a significant turning point. These systems, 
inspired by the structure of the human brain, showed promise in pattern recognition and learning 
from data. However, limitations in computing power and data availability meant that progress was 
slow. It wasn't until the 2010s, with the advent of deep learning and the availability of massive 
datasets and powerful GPUs, that AI truly began to transform various industries.
"""
    
    hat = SortingHat(openai_client=MockOpenAI())
    analysis = hat._analyze_chunk_size(content)
    
    print("\n=== Long-Form Narrative ===")
    print(f"Optimal size: {analysis['optimal_size']}")
    print(f"Reasoning: {analysis['reasoning']}")
    print(f"Confidence: {analysis['confidence']}")
    print(f"Metrics: {analysis['metrics']}")
    
    assert analysis['optimal_size'] == 512, "Long-form narrative should use 512 token chunks"
    assert analysis['confidence'] >= 0.7, "Should have good confidence"


def test_very_long_paragraphs():
    """Test that very long paragraphs get extra large chunks (1024 tokens)."""
    content = """
The comprehensive analysis of modern distributed systems architecture reveals a complex interplay 
between various components, each designed to handle specific aspects of scalability, reliability, 
and performance optimization, while simultaneously addressing the challenges of data consistency, 
network partitioning, and fault tolerance in environments where traditional monolithic approaches 
have proven inadequate for meeting the demands of contemporary applications that must serve millions 
of concurrent users across geographically distributed regions, requiring sophisticated load balancing 
mechanisms, caching strategies, and database replication techniques that work in concert to ensure 
that user requests are processed efficiently regardless of their origin or the current state of the 
system's infrastructure, which may include multiple data centers, edge computing nodes, and content 
delivery networks that collectively form a resilient and responsive platform capable of adapting to 
varying traffic patterns and gracefully degrading in the face of component failures while maintaining 
acceptable levels of service quality and user experience.
"""
    
    hat = SortingHat(openai_client=MockOpenAI())
    analysis = hat._analyze_chunk_size(content)
    
    print("\n=== Very Long Paragraphs ===")
    print(f"Optimal size: {analysis['optimal_size']}")
    print(f"Reasoning: {analysis['reasoning']}")
    print(f"Confidence: {analysis['confidence']}")
    print(f"Metrics: {analysis['metrics']}")
    
    assert analysis['optimal_size'] == 1024, "Very long paragraphs should use 1024 token chunks"
    assert analysis['confidence'] >= 0.7, "Should have good confidence"


def test_mixed_content():
    """Test that standard mixed content gets default medium chunks (256 tokens)."""
    content = """
This is a regular document with normal paragraphs.

It has some structure but nothing too complex.

The sentences are of average length and the content is general.

There are a few technical terms like API and database, but not many.
"""
    
    hat = SortingHat(openai_client=MockOpenAI())
    analysis = hat._analyze_chunk_size(content)
    
    print("\n=== Mixed Content ===")
    print(f"Optimal size: {analysis['optimal_size']}")
    print(f"Reasoning: {analysis['reasoning']}")
    print(f"Confidence: {analysis['confidence']}")
    print(f"Metrics: {analysis['metrics']}")
    
    assert analysis['optimal_size'] == 256, "Mixed content should use default 256 token chunks"


def test_full_sorting_hat_integration():
    """Test that chunk size analysis is integrated into full Sorting Hat workflow."""
    content = """
# API Documentation

## Authentication

All API requests require authentication using Bearer tokens.

### Getting a Token

POST /auth/token
Body: { "username": "user", "password": "pass" }
Response: { "token": "abc123" }

### Using the Token

Include in header: Authorization: Bearer abc123

## Endpoints

### GET /users
Returns list of users.

### POST /users
Creates a new user.
"""
    
    hat = SortingHat(openai_client=MockOpenAI())
    config = hat.sort(content, "api_docs.md")
    
    print("\n=== Full Integration Test ===")
    print(f"Strategy: {config['strategy']}")
    print(f"Chunk size: {config['chunk_size']}")
    print(f"Chunk overlap: {config['chunk_overlap']}")
    print(f"Chunk size reasoning: {config['chunk_size_analysis']['reasoning']}")
    
    assert 'chunk_size' in config, "Config should include chunk_size"
    assert 'chunk_overlap' in config, "Config should include chunk_overlap"
    assert 'chunk_size_analysis' in config, "Config should include chunk_size_analysis"
    assert config['chunk_overlap'] == int(config['chunk_size'] * 0.2), "Overlap should be 20% of chunk size"


if __name__ == "__main__":
    print("Testing Chunk Size Analysis")
    print("=" * 50)
    
    try:
        test_dense_technical_content()
        print("✓ Dense technical content test passed")
    except AssertionError as e:
        print(f"✗ Dense technical content test failed: {e}")
    
    try:
        test_well_structured_content()
        print("✓ Well-structured content test passed")
    except AssertionError as e:
        print(f"✗ Well-structured content test failed: {e}")
    
    try:
        test_long_form_narrative()
        print("✓ Long-form narrative test passed")
    except AssertionError as e:
        print(f"✗ Long-form narrative test failed: {e}")
    
    try:
        test_very_long_paragraphs()
        print("✓ Very long paragraphs test passed")
    except AssertionError as e:
        print(f"✗ Very long paragraphs test failed: {e}")
    
    try:
        test_mixed_content()
        print("✓ Mixed content test passed")
    except AssertionError as e:
        print(f"✗ Mixed content test failed: {e}")
    
    try:
        test_full_sorting_hat_integration()
        print("✓ Full integration test passed")
    except AssertionError as e:
        print(f"✗ Full integration test failed: {e}")
    
    print("\n" + "=" * 50)
    print("All tests completed!")
