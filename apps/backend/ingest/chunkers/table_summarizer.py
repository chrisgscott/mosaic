"""
Table Summarizer

Generates natural language summaries of markdown tables to improve RAG retrieval.
The summary captures key facts, aggregates, and context that embed well semantically,
while the original table is preserved for the LLM to read when answering.

Pattern: "table-to-text for retrieval, original table for answering"
"""

import logging
import os
from typing import Optional
from openai import OpenAI

logger = logging.getLogger(__name__)

# System prompt for table summarization
TABLE_SUMMARY_PROMPT = """You are a precise data analyst. Given a markdown table and its document context, generate a concise natural language summary that captures:

1. Document type and identifier (e.g., "Packing list #3", "Invoice dated 2024-01-15")
2. What the table is about (type of data)
3. Key entities/items mentioned (companies, products, people)
4. Important aggregates (totals, counts, ranges)
5. Any notable values or patterns

Rules:
- START with the document type/name from the context (e.g., "Packing list", "Invoice", "Price list")
- Be factual and precise - only state what's in the table
- Include specific numbers when relevant
- Keep it to 2-4 sentences
- Don't say "this table shows" - just state the facts directly
- If there are totals or summary rows, include them
- Include company names, product names, dates if present

Example output:
"UNA-Group packing list #3 (dated 22.01.07) for shipment to Maxcom Management Ltd: 16 packages of ultrafine copper powder (Lot 11/12-05, Code 7406100000). Gross weights range from 99.5-104.5 kg per package, net weight 63 kg each. Total: 1644.5 kg gross, 1008 kg net."
"""


class TableSummarizer:
    """Generates natural language summaries of tables for improved retrieval."""
    
    def __init__(self, model: str = "gpt-4o-mini", enabled: bool = True):
        """
        Initialize table summarizer.
        
        Args:
            model: OpenAI model to use for summarization
            enabled: Whether summarization is enabled (can be disabled for cost savings)
        """
        self.model = model
        self.enabled = enabled
        self.client = None
        
        if enabled:
            api_key = os.getenv('OPENAI_API_KEY')
            if api_key:
                self.client = OpenAI(api_key=api_key)
                logger.info(f"TableSummarizer initialized with model={model}")
            else:
                logger.warning("OPENAI_API_KEY not set - table summarization disabled")
                self.enabled = False
    
    def summarize_table(self, table_markdown: str, context: str = "") -> Optional[str]:
        """
        Generate a natural language summary of a markdown table.
        
        Args:
            table_markdown: The markdown table content
            context: Optional context (e.g., section heading, breadcrumb)
            
        Returns:
            Natural language summary, or None if summarization fails/disabled
        """
        if not self.enabled or not self.client:
            return None
        
        # Skip very small tables (likely not worth summarizing)
        row_count = table_markdown.count('\n')
        if row_count < 3:  # Header + separator + at least 1 data row
            logger.debug("Skipping table summarization - too few rows")
            return None
        
        try:
            # Build the prompt
            user_prompt = table_markdown
            if context:
                user_prompt = f"Context: {context}\n\nTable:\n{table_markdown}"
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": TABLE_SUMMARY_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,  # Low temperature for factual output
                max_tokens=300
            )
            
            summary = response.choices[0].message.content.strip()
            logger.debug(f"Generated table summary: {summary[:100]}...")
            return summary
            
        except Exception as e:
            logger.warning(f"Table summarization failed: {e}")
            return None
    
    def format_chunk_with_summary(self, table_content: str, summary: Optional[str]) -> str:
        """
        Format a table chunk with its summary prepended.
        
        Args:
            table_content: The original table markdown
            summary: The generated summary (or None)
            
        Returns:
            Formatted content with summary + original table
        """
        if summary:
            return f"**Table Summary:** {summary}\n\n{table_content}"
        return table_content
