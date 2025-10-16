// Search progress tracking for UI feedback
export type SearchProgressStep = 
  | 'analyzing'
  | 'generating-variations'
  | 'generating-hyde'
  | 'creating-embeddings'
  | 'searching'
  | 'searching-graph'
  | 'expanding-graph'
  | 'merging-results'
  | 'reranking'
  | 'complete';

export interface SearchProgressEvent {
  step: SearchProgressStep;
  message: string;
  status: 'pending' | 'in-progress' | 'completed';
  timestamp: number;
}

// User-friendly messages for each step
export const PROGRESS_MESSAGES: Record<SearchProgressStep, string> = {
  'analyzing': 'Analyzing your question',
  'generating-variations': 'Finding the best ways to search',
  'generating-hyde': 'Imagining the perfect answer',
  'creating-embeddings': 'Preparing search queries',
  'searching': 'Searching through your documents',
  'searching-graph': 'Exploring knowledge connections',
  'expanding-graph': 'Following related concepts',
  'merging-results': 'Combining results',
  'reranking': 'Ranking by relevance',
  'complete': 'Search complete',
};

// Progress callback type
export type ProgressCallback = (event: SearchProgressEvent) => void;

// Helper to create progress events
export function createProgressEvent(
  step: SearchProgressStep,
  status: 'pending' | 'in-progress' | 'completed' = 'in-progress'
): SearchProgressEvent {
  return {
    step,
    message: PROGRESS_MESSAGES[step],
    status,
    timestamp: Date.now(),
  };
}
