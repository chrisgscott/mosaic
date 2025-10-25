"""
Document Augmentation Chunker

Generates questions from chunks to improve query matching without hallucination.
This is a composable enhancement that wraps any base chunker.

Philosophy:
- HyDE hallucinates facts (especially for acronyms)
- Instead, generate questions FROM the actual document content
- Store questions as searchable items that link back to source chunks
- When a question matches, return the original chunk (no hallucination!)

Example:
  Document: "TTI (Tactical Training Institute) provides military training..."
  Generated Questions:
    - "What does TTI stand for?"
    - "What is the Tactical Training Institute?"
    - "What services does TTI provide?"
  
  User Query: "What does TTI stand for?"
  Matches: Generated question (exact semantic match)
  Returns: Original document chunk (CORRECT!)
"""

from typing import List, Dict, Any
import logging
import uuid
import tiktoken
from openai import OpenAI

logger = logging.getLogger(__name__)


class DocumentAugmentationChunker:
    """
    Generates questions from chunks to improve query matching.
    Replaces HyDE with a non-hallucinating alternative.
    """
    
    def __init__(self, base_chunker, questions_per_chunk: int = 5, model: str = "gpt-4o-mini"):
        """
        Initialize the document augmentation chunker.
        
        Args:
            base_chunker: The base chunker to wrap (e.g., StructureAwareChunker)
            questions_per_chunk: Number of questions to generate per chunk (default: 5)
            model: OpenAI model to use for question generation (default: gpt-4o-mini)
        """
        self.base_chunker = base_chunker
        self.questions_per_chunk = questions_per_chunk
        self.model = model
        self.client = OpenAI()
        self.tokenizer = tiktoken.get_encoding("cl100k_base")  # For token counting
        logger.info(f"DocumentAugmentationChunker initialized (questions_per_chunk={questions_per_chunk}, model={model})")
    
    def chunk_document(self, doc, document_id: str) -> List[Dict[str, Any]]:
        """
        Chunk document and generate augmented questions.
        
        Args:
            doc: Docling document object
            document_id: Document ID for chunk references
            
        Returns:
            List of chunks (both ORIGINAL chunks and AUGMENTED_QUESTION chunks)
        """
        logger.info(f"Starting document augmentation for document {document_id}")
        
        # 1. Get base chunks from wrapped chunker
        base_chunks = self.base_chunker.chunk_document(doc, document_id)
        logger.info(f"Base chunker produced {len(base_chunks)} chunks")
        
        # 2. Generate questions for each chunk and cache them
        augmented_chunks = []
        questions_cache = {}  # Cache questions to avoid regenerating
        questions_generated = 0
        
        # First pass: Generate questions and add ORIGINAL chunks
        for chunk in base_chunks:
            # Generate and cache questions for this chunk
            questions = self._generate_questions(chunk['content'])
            questions_cache[chunk['id']] = questions
            questions_generated += len(questions)
            
            # Store original chunk with augmentation metadata
            # IMPORTANT: Must have same keys as AUGMENTED_QUESTION chunks for batch insert
            original_chunk = {
                **chunk,
                'chunk_type': 'ORIGINAL',
                'parent_chunk_id': None,  # ORIGINAL chunks have no parent
            }
            # Store question count in metadata instead of top-level
            original_chunk['metadata']['augmented_question_count'] = len(questions)
            augmented_chunks.append(original_chunk)
        
        # Second pass: Add AUGMENTED_QUESTION chunks with unique sequential indexes
        # Start indexing after the last ORIGINAL chunk to avoid unique constraint violation
        question_index_offset = len(base_chunks)
        current_question_index = question_index_offset
        
        for chunk in base_chunks:
            # Retrieve cached questions
            questions = questions_cache[chunk['id']]
            
            # Store each question as a separate searchable chunk
            # IMPORTANT: Must have same keys as ORIGINAL chunks for batch insert
            for question in questions:
                question_chunk = {
                    'id': str(uuid.uuid4()),
                    'document_id': document_id,
                    'chunk_index': current_question_index,  # Unique sequential index
                    'content': question,
                    'token_count': len(self.tokenizer.encode(question)),  # Accurate token count
                    'chunk_type': 'AUGMENTED_QUESTION',
                    'parent_chunk_id': chunk['id'],  # Link back to original
                    'metadata': {
                        **chunk.get('metadata', {}),
                        'is_augmented': True,
                        'parent_chunk_index': chunk['chunk_index'],  # Store parent's index for reference
                        'parent_content_preview': chunk['content'][:200] + '...' if len(chunk['content']) > 200 else chunk['content']
                    }
                }
                augmented_chunks.append(question_chunk)
                current_question_index += 1
        
        logger.info(f"Document augmentation complete: {len(base_chunks)} original chunks, {questions_generated} questions generated")
        logger.info(f"Total chunks (original + questions): {len(augmented_chunks)}")
        
        return augmented_chunks
    
    def _generate_questions(self, chunk_content: str) -> List[str]:
        """
        Generate questions that this chunk can answer.
        
        Args:
            chunk_content: The text content of the chunk
            
        Returns:
            List of generated questions
        """
        prompt = f"""Generate {self.questions_per_chunk} questions that can be answered by this text.

Questions should:
- Be specific and factual
- Use terminology and acronyms from the text
- Cover different aspects of the content
- Be phrased as users would naturally ask them
- Focus on key concepts, definitions, and relationships

Text:
{chunk_content}

Return ONLY the questions, one per line, without numbering or bullets."""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a question generation expert. Generate clear, specific questions that can be answered by the provided text."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,  # Low temperature for consistent, focused questions
                max_tokens=500
            )
            
            # Parse questions from response
            questions_text = response.choices[0].message.content
            questions = [q.strip() for q in questions_text.split('\n') if q.strip()]
            
            # Remove any numbering or bullets that might have been added
            questions = [q.lstrip('0123456789.-) ') for q in questions]
            
            # Limit to requested number
            questions = questions[:self.questions_per_chunk]
            
            logger.debug(f"Generated {len(questions)} questions for chunk")
            return questions
            
        except Exception as e:
            logger.error(f"Error generating questions: {e}")
            return []  # Return empty list on error, don't fail the whole process
