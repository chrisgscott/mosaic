"""
The Sorting Hat - Intelligent Chunking Strategy Router

Analyzes documents and determines the optimal chunking strategy based on:
- Document type and structure
- Size and complexity
- Content patterns
- User preferences

Like the Harry Potter Sorting Hat, but for chunking strategies! 🎩✨
"""

import logging
import json
from typing import Dict, Any, Optional
from openai import OpenAI

logger = logging.getLogger(__name__)


class SortingHat:
    """
    Analyzes documents and routes them to the optimal chunking strategy.
    """
    
    def __init__(self, openai_client: OpenAI = None, model: str = "gpt-4o-mini"):
        """
        Initialize the Sorting Hat.
        
        Args:
            openai_client: OpenAI client for analysis
            model: Model to use for analysis (fast and cheap)
        """
        self.openai_client = openai_client or OpenAI()
        self.model = model
        
        logger.info(f"🎩 Sorting Hat initialized with model={self.model}")
    
    def sort(
        self, 
        content: str, 
        file_name: str,
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze document and determine optimal chunking strategy.
        
        Args:
            content: Document content (full text or sample)
            file_name: Original file name
            user_preferences: Optional user preferences for chunking
            
        Returns:
            Chunking configuration with strategy and parameters
        """
        logger.info(f"🎩 Sorting Hat analyzing: {file_name}")
        
        # Sample document if too large
        sample = self._create_sample(content)
        
        # Analyze document
        analysis = self._analyze_document(sample, file_name, user_preferences)
        
        # Determine strategy
        config = self._determine_strategy(analysis, len(content), user_preferences)
        
        logger.info(f"🎩 Sorted into: {config['strategy']} (confidence: {config.get('confidence', 'N/A')})")
        logger.info(f"   Reasoning: {config.get('reasoning', 'N/A')}")
        
        return config
    
    def _create_sample(self, content: str, sample_size: int = 10000) -> str:
        """
        Create a representative sample of the document.
        
        Takes beginning, middle, and end sections.
        """
        if len(content) <= sample_size * 3:
            return content
        
        # Sample from beginning, middle, end
        chunk_size = sample_size
        beginning = content[:chunk_size]
        middle_start = len(content) // 2 - chunk_size // 2
        middle = content[middle_start:middle_start + chunk_size]
        end = content[-chunk_size:]
        
        return f"{beginning}\n\n[...middle section...]\n\n{middle}\n\n[...end section...]\n\n{end}"
    
    def _analyze_document(
        self, 
        sample: str, 
        file_name: str,
        user_preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze document characteristics using LLM.
        """
        prompt = f"""Analyze this document and provide a detailed assessment for chunking strategy selection.

FILE NAME: {file_name}
DOCUMENT SAMPLE:
{sample}

USER PREFERENCES: {json.dumps(user_preferences or {}, indent=2)}

Analyze and provide JSON:
{{
  "document_type": "research_paper" | "manual" | "card_deck" | "article" | "transcript" | "reference" | "book" | "legal" | "other",
  "structure_type": "hierarchical" | "sequential" | "card_based" | "unstructured" | "mixed",
  "complexity": "simple" | "moderate" | "complex",
  "has_clear_sections": true | false,
  "has_tables": true | false,
  "has_code": true | false,
  "has_figures": true | false,
  "repeating_patterns": ["pattern1", "pattern2"],
  "heading_consistency": "consistent" | "variable" | "none",
  "estimated_size": "small" | "medium" | "large" | "massive",
  "key_characteristics": ["characteristic1", "characteristic2"],
  "recommended_strategy": "hybrid" | "agentic" | "planner_executor" | "custom_boundary",
  "reasoning": "Why this strategy is recommended",
  "confidence": "high" | "medium" | "low"
}}

STRATEGY DESCRIPTIONS:
- **hybrid**: Fast, structure-aware, good for general documents with clear hierarchy
- **custom_boundary**: Pattern-based, good for documents with consistent markers (e.g., "Recipe", "Chapter")
- **agentic**: LLM-powered semantic analysis, good for variable structure (e.g., card decks with changing labels)
- **planner_executor**: Optimal for complex/large documents, uses large-context planner + cheap executor

Consider:
1. Document structure and consistency
2. Size and complexity
3. Presence of patterns or markers
4. Need for semantic understanding
5. Cost vs accuracy tradeoff"""
        
        try:
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a document analysis expert specializing in chunking strategy selection. Analyze documents and recommend optimal chunking approaches."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            analysis = json.loads(response.choices[0].message.content)
            logger.debug(f"Document analysis: {json.dumps(analysis, indent=2)}")
            
            return analysis
            
        except Exception as e:
            logger.error(f"Error analyzing document: {e}")
            # Fallback to safe default
            return {
                "document_type": "other",
                "structure_type": "mixed",
                "recommended_strategy": "hybrid",
                "reasoning": "Analysis failed, using safe default",
                "confidence": "low"
            }
    
    def _determine_strategy(
        self, 
        analysis: Dict[str, Any], 
        content_length: int,
        user_preferences: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Determine final chunking configuration based on analysis.
        """
        # Start with LLM recommendation
        strategy = analysis.get('recommended_strategy', 'hybrid')
        
        # Estimate tokens
        estimated_tokens = int(content_length / 4)  # Rough estimate
        
        # Override based on size if needed
        if estimated_tokens > 1_000_000:
            logger.info(f"Document very large ({estimated_tokens} tokens) - forcing planner_executor")
            strategy = 'planner_executor'
        
        # Check user preferences override
        if user_preferences and user_preferences.get('force_strategy'):
            strategy = user_preferences['force_strategy']
            logger.info(f"User preference override: {strategy}")
        
        # Build configuration based on strategy
        config = {
            "strategy": strategy,
            "confidence": analysis.get('confidence', 'medium'),
            "reasoning": analysis.get('reasoning', 'Based on document analysis'),
            "document_type": analysis.get('document_type'),
            "analysis": analysis
        }
        
        # Add strategy-specific parameters
        if strategy == 'hybrid':
            config.update({
                "max_chunk_tokens": 512,
                "respect_headings": True
            })
        
        elif strategy == 'custom_boundary':
            # Suggest boundary markers based on patterns
            config.update({
                "boundary_markers": analysis.get('repeating_patterns', []),
                "max_chunk_tokens": 512
            })
        
        elif strategy == 'agentic':
            config.update({
                "model": "gpt-4o-mini",
                "document_type": analysis.get('document_type'),
                "max_chunk_tokens": 512,
                "instructions": self._generate_instructions(analysis)
            })
        
        elif strategy == 'planner_executor':
            # Choose planner model based on size
            if estimated_tokens > 500_000:
                planner_model = "gemini-2.0-flash-exp"  # 2M context
                planner_provider = "google"
            else:
                planner_model = "gpt-4o"  # 128K context
                planner_provider = "openai"
            
            config.update({
                "planner_model": planner_model,
                "planner_provider": planner_provider,
                "executor_model": "gpt-4o-mini",
                "max_chunk_tokens": 500,
                "overlap_ratio": 0.15,
                "document_type": analysis.get('document_type'),
                "max_planner_tokens": 1_000_000,
                "section_parallel_workers": 10
            })
        
        return config
    
    def _generate_instructions(self, analysis: Dict[str, Any]) -> str:
        """
        Generate custom instructions for agentic chunking based on analysis.
        """
        doc_type = analysis.get('document_type', 'general')
        structure = analysis.get('structure_type', 'mixed')
        characteristics = analysis.get('key_characteristics', [])
        
        instructions = f"This is a {doc_type} document with {structure} structure.\n\n"
        
        if doc_type == 'card_deck':
            instructions += """Each card is a complete concept with:
- A category label (may vary)
- A title
- Description
- Steps or details
- Footer/attribution

Identify card boundaries and keep each card as one chunk."""
        
        elif doc_type == 'research_paper':
            instructions += """This is a research paper with sections like:
- Abstract
- Introduction
- Methods
- Results
- Discussion
- References

Preserve section boundaries and keep related content together."""
        
        elif doc_type == 'manual':
            instructions += """This is a technical manual with:
- Procedures
- Instructions
- Examples
- Warnings/notes

Keep complete procedures together as semantic units."""
        
        else:
            instructions += f"""Key characteristics: {', '.join(characteristics)}

Identify semantic boundaries that preserve conceptual completeness."""
        
        return instructions


def create_sorting_hat_config(
    content: str,
    file_name: str,
    user_preferences: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Convenience function to create chunking config using Sorting Hat.
    
    Args:
        content: Document content
        file_name: Original file name
        user_preferences: Optional user preferences
        
    Returns:
        Chunking configuration ready to use
    """
    hat = SortingHat()
    return hat.sort(content, file_name, user_preferences)
