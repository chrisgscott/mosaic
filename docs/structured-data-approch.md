# Yes! This is a brilliant approach for structured data in RAG systems

What you're describing is actually a sophisticated strategy that solves a major problem in RAG: **how to make structured data (tables, CSVs, spreadsheets) searchable and understandable through natural language queries**. Let me break down what this means and how to implement it with R2R + Supabase.

## The Problem with Traditional Table Ingestion

Traditional RAG systems struggle with tables because:
- Tables chunked row-by-row lose context
- Column headers separated from data lose meaning  
- Relationships between cells aren't preserved
- Semantic search on raw CSV data performs poorly

## Your "Long Table + Narrative" Solution

This approach brilliantly combines:
1. **Long Table Format**: Transforming wide tables into normalized, searchable format
2. **Document Narrative**: AI-generated natural language description of the data
3. **Bidirectional Linking**: Connect narrative chunks to specific table regions

Here's the complete implementation:

## 1. Enhanced Database Schema for Structured Data

```sql
-- Long table format for any structured data
CREATE TABLE public.structured_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    row_id INTEGER NOT NULL,
    column_name TEXT NOT NULL,
    column_value TEXT,
    column_type TEXT, -- 'numeric', 'text', 'date', 'boolean'
    original_row_index INTEGER,
    original_column_index INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Narrative descriptions of structured data
CREATE TABLE public.data_narratives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    narrative_type TEXT, -- 'summary', 'analysis', 'trends', 'anomalies'
    narrative_text TEXT NOT NULL,
    narrative_embedding vector(1536),
    scope TEXT, -- 'document', 'table', 'column', 'row_group'
    scope_reference JSONB, -- Which parts of data this describes
    confidence_score FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link narrative chunks to specific data points
CREATE TABLE public.narrative_data_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    narrative_id UUID REFERENCES data_narratives(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES chunks(id) ON DELETE CASCADE,
    structured_data_ids UUID[], -- Array of structured_data IDs this references
    link_type TEXT, -- 'describes', 'analyzes', 'summarizes', 'explains'
    relevance_score FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_structured_data_document ON structured_data(document_id);
CREATE INDEX idx_structured_data_table ON structured_data(table_name);
CREATE INDEX idx_structured_data_column ON structured_data(column_name);
CREATE INDEX idx_structured_data_value ON structured_data USING gin(to_tsvector('english', column_value));
CREATE INDEX idx_data_narratives_embedding ON data_narratives USING ivfflat (narrative_embedding vector_cosine_ops);
```

## 2. Structured Data Processor

```python
# structured_data_processor.py
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
import json
from datetime import datetime
import openai

class StructuredDataProcessor:
    """
    Processes CSV/XLSX files into long table format with narratives
    """
    
    def __init__(self, r2r_adapter, supabase_client):
        self.r2r = r2r_adapter
        self.supabase = supabase_client
        self.openai_client = openai.Client()
    
    async def process_structured_file(
        self,
        file_path: str,
        document_id: str,
        collection_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Main entry point for processing structured data
        """
        # Load the data
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_path}")
        
        # Step 1: Convert to long table format
        long_table_ids = await self._create_long_table(df, document_id)
        
        # Step 2: Generate narratives at different levels
        narratives = await self._generate_narratives(df, document_id)
        
        # Step 3: Create narrative chunks for RAG
        chunk_ids = await self._create_narrative_chunks(
            narratives, 
            document_id, 
            collection_id
        )
        
        # Step 4: Link narratives to data
        await self._link_narratives_to_data(
            narratives, 
            long_table_ids, 
            chunk_ids
        )
        
        # Step 5: Generate and store embeddings
        await self._generate_embeddings(narratives)
        
        return {
            'document_id': document_id,
            'rows_processed': len(df),
            'columns_processed': len(df.columns),
            'narratives_generated': len(narratives),
            'chunks_created': len(chunk_ids)
        }
    
    async def _create_long_table(
        self, 
        df: pd.DataFrame, 
        document_id: str
    ) -> List[str]:
        """
        Convert DataFrame to long table format in database
        """
        long_table_records = []
        
        for row_idx, row in df.iterrows():
            for col_idx, (col_name, value) in enumerate(row.items()):
                # Determine column type
                col_type = 'text'
                if pd.api.types.is_numeric_dtype(df[col_name]):
                    col_type = 'numeric'
                elif pd.api.types.is_datetime64_any_dtype(df[col_name]):
                    col_type = 'date'
                elif pd.api.types.is_bool_dtype(df[col_name]):
                    col_type = 'boolean'
                
                record = {
                    'document_id': document_id,
                    'table_name': 'main',  # Could extract from filename
                    'row_id': row_idx,
                    'column_name': str(col_name),
                    'column_value': str(value) if pd.notna(value) else None,
                    'column_type': col_type,
                    'original_row_index': row_idx,
                    'original_column_index': col_idx,
                    'metadata': {
                        'is_null': pd.isna(value),
                        'original_type': str(df[col_name].dtype)
                    }
                }
                long_table_records.append(record)
        
        # Bulk insert into database
        result = await self.supabase.table('structured_data').insert(
            long_table_records
        ).execute()
        
        return [r['id'] for r in result.data]
    
    async def _generate_narratives(
        self, 
        df: pd.DataFrame, 
        document_id: str
    ) -> List[Dict[str, Any]]:
        """
        Generate multiple levels of narratives for the data
        """
        narratives = []
        
        # 1. Document-level summary
        doc_summary = await self._generate_document_summary(df)
        narratives.append({
            'document_id': document_id,
            'narrative_type': 'summary',
            'narrative_text': doc_summary,
            'scope': 'document',
            'scope_reference': {'full_document': True}
        })
        
        # 2. Statistical analysis
        stats_analysis = await self._generate_statistical_analysis(df)
        narratives.append({
            'document_id': document_id,
            'narrative_type': 'analysis',
            'narrative_text': stats_analysis,
            'scope': 'document',
            'scope_reference': {'analysis_type': 'statistical'}
        })
        
        # 3. Column-specific narratives
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                col_narrative = await self._generate_column_narrative(df, col)
                narratives.append({
                    'document_id': document_id,
                    'narrative_type': 'analysis',
                    'narrative_text': col_narrative,
                    'scope': 'column',
                    'scope_reference': {'column': col}
                })
        
        # 4. Trend analysis (if time series detected)
        if self._detect_time_series(df):
            trend_narrative = await self._generate_trend_analysis(df)
            narratives.append({
                'document_id': document_id,
                'narrative_type': 'trends',
                'narrative_text': trend_narrative,
                'scope': 'document',
                'scope_reference': {'analysis_type': 'time_series'}
            })
        
        # 5. Anomaly detection narrative
        anomalies = await self._detect_and_describe_anomalies(df)
        if anomalies:
            narratives.append({
                'document_id': document_id,
                'narrative_type': 'anomalies',
                'narrative_text': anomalies,
                'scope': 'document',
                'scope_reference': {'analysis_type': 'anomaly_detection'}
            })
        
        return narratives
    
    async def _generate_document_summary(self, df: pd.DataFrame) -> str:
        """
        Generate high-level summary of the entire dataset
        """
        # Create a data profile
        profile = {
            'shape': df.shape,
            'columns': list(df.columns),
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
            'missing_values': df.isnull().sum().to_dict(),
            'numeric_summary': df.describe().to_dict() if len(df.select_dtypes(include=[np.number]).columns) > 0 else {},
            'sample_rows': df.head(3).to_dict('records')
        }
        
        prompt = f"""You are a data analyst expert. Generate a comprehensive natural language summary 
        of this dataset that would help someone understand what it contains and how it might be used.
        
        Dataset Profile:
        {json.dumps(profile, indent=2, default=str)}
        
        Include:
        1. What this data appears to represent
        2. Key columns and their likely purposes
        3. Data quality observations
        4. Potential use cases or insights
        5. Any notable patterns or characteristics
        
        Write in clear, professional prose suitable for a technical report.
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800
        )
        
        return response.choices[0].message.content
    
    async def _generate_statistical_analysis(self, df: pd.DataFrame) -> str:
        """
        Generate statistical analysis narrative
        """
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        if len(numeric_cols) == 0:
            return "This dataset contains no numeric columns for statistical analysis."
        
        stats = {}
        for col in numeric_cols:
            stats[col] = {
                'mean': df[col].mean(),
                'median': df[col].median(),
                'std': df[col].std(),
                'min': df[col].min(),
                'max': df[col].max(),
                'q25': df[col].quantile(0.25),
                'q75': df[col].quantile(0.75),
                'skew': df[col].skew(),
                'kurtosis': df[col].kurtosis(),
                'null_count': df[col].isnull().sum(),
                'unique_count': df[col].nunique()
            }
        
        # Calculate correlations
        if len(numeric_cols) > 1:
            correlations = df[numeric_cols].corr().to_dict()
        else:
            correlations = None
        
        prompt = f"""Generate a statistical analysis narrative for this dataset.
        
        Statistical Summary:
        {json.dumps(stats, indent=2, default=str)}
        
        Correlations:
        {json.dumps(correlations, indent=2, default=str) if correlations else "N/A - only one numeric column"}
        
        Describe:
        1. Key statistical properties of each numeric column
        2. Distribution characteristics (normal, skewed, etc.)
        3. Notable correlations between variables
        4. Data quality issues (outliers, missing values)
        5. Recommendations for further analysis
        
        Write in a technical but accessible style.
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600
        )
        
        return response.choices[0].message.content
    
    async def _generate_column_narrative(
        self, 
        df: pd.DataFrame, 
        column: str
    ) -> str:
        """
        Generate narrative for a specific column
        """
        col_data = df[column]
        
        analysis = {
            'column_name': column,
            'dtype': str(col_data.dtype),
            'unique_values': col_data.nunique(),
            'null_percentage': (col_data.isnull().sum() / len(col_data)) * 100,
            'top_values': col_data.value_counts().head(10).to_dict() if col_data.nunique() < 100 else None,
            'statistics': {
                'mean': col_data.mean() if pd.api.types.is_numeric_dtype(col_data) else None,
                'std': col_data.std() if pd.api.types.is_numeric_dtype(col_data) else None,
                'min': col_data.min() if pd.api.types.is_numeric_dtype(col_data) else None,
                'max': col_data.max() if pd.api.types.is_numeric_dtype(col_data) else None,
            }
        }
        
        prompt = f"""Describe the column '{column}' in natural language.
        
        Column Analysis:
        {json.dumps(analysis, indent=2, default=str)}
        
        Provide a concise narrative that explains:
        1. What this column likely represents
        2. Key characteristics and distribution
        3. Data quality observations
        4. Potential relationships with other data
        
        Keep it to 2-3 paragraphs.
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=300
        )
        
        return f"Column '{column}': {response.choices[0].message.content}"
    
    def _detect_time_series(self, df: pd.DataFrame) -> bool:
        """
        Detect if data contains time series
        """
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                return True
            # Check if column name suggests date/time
            if any(term in col.lower() for term in ['date', 'time', 'year', 'month', 'day']):
                try:
                    pd.to_datetime(df[col])
                    return True
                except:
                    pass
        return False
    
    async def _generate_trend_analysis(self, df: pd.DataFrame) -> str:
        """
        Generate trend analysis for time series data
        """
        # Find date column
        date_col = None
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                date_col = col
                break
            try:
                pd.to_datetime(df[col])
                date_col = col
                break
            except:
                continue
        
        if not date_col:
            return "No time series trends detected."
        
        # Convert to datetime if needed
        df[date_col] = pd.to_datetime(df[date_col])
        df_sorted = df.sort_values(date_col)
        
        # Calculate trends for numeric columns
        trends = {}
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            # Simple linear regression trend
            x = np.arange(len(df_sorted))
            y = df_sorted[col].fillna(method='ffill').values
            
            if len(y) > 1:
                z = np.polyfit(x, y, 1)
                trend_direction = "increasing" if z[0] > 0 else "decreasing"
                trend_strength = abs(z[0])
                
                trends[col] = {
                    'direction': trend_direction,
                    'strength': float(trend_strength),
                    'start_value': float(y[0]),
                    'end_value': float(y[-1]),
                    'percent_change': ((y[-1] - y[0]) / y[0] * 100) if y[0] != 0 else 0
                }
        
        prompt = f"""Analyze the time series trends in this data.
        
        Time Period: {df_sorted[date_col].min()} to {df_sorted[date_col].max()}
        Trends Detected:
        {json.dumps(trends, indent=2, default=str)}
        
        Provide a narrative that describes:
        1. Overall trend patterns observed
        2. Notable changes or inflection points
        3. Relationships between different trending variables
        4. Potential seasonality or cycles
        5. Forward-looking insights or predictions
        
        Write in a analytical, business-friendly style.
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500
        )
        
        return response.choices[0].message.content
    
    async def _detect_and_describe_anomalies(self, df: pd.DataFrame) -> Optional[str]:
        """
        Detect and describe anomalies in the data
        """
        anomalies = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            # Use IQR method for outlier detection
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
            
            if len(outliers) > 0:
                anomalies.append({
                    'column': col,
                    'outlier_count': len(outliers),
                    'outlier_percentage': (len(outliers) / len(df)) * 100,
                    'outlier_values': outliers[col].tolist()[:10],  # First 10
                    'bounds': {'lower': lower_bound, 'upper': upper_bound}
                })
        
        if not anomalies:
            return None
        
        prompt = f"""Describe the anomalies detected in this dataset.
        
        Anomalies Found:
        {json.dumps(anomalies, indent=2, default=str)}
        
        Provide a narrative that:
        1. Describes what anomalies were found
        2. Explains potential causes or significance
        3. Recommends whether these need investigation
        4. Suggests how to handle them in analysis
        
        Be concise but thorough.
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=400
        )
        
        return response.choices[0].message.content
    
    async def _create_narrative_chunks(
        self,
        narratives: List[Dict[str, Any]],
        document_id: str,
        collection_id: str
    ) -> List[str]:
        """
        Create R2R chunks from narratives for RAG retrieval
        """
        chunk_ids = []
        
        for narrative in narratives:
            # Split long narratives into chunks if needed
            text = narrative['narrative_text']
            
            # Create chunks with overlap for better retrieval
            chunk_size = 500  # characters
            chunk_overlap = 100
            
            chunks = []
            if len(text) > chunk_size:
                for i in range(0, len(text), chunk_size - chunk_overlap):
                    chunk_text = text[i:i + chunk_size]
                    chunks.append(chunk_text)
            else:
                chunks = [text]
            
            # Create chunks in R2R
            for chunk_idx, chunk_text in enumerate(chunks):
                response = self.r2r.r2r_client.chunks.create(
                    chunks=[{
                        "text": chunk_text,
                        "metadata": {
                            "document_id": document_id,
                            "collection_id": collection_id,
                            "narrative_type": narrative['narrative_type'],
                            "scope": narrative['scope'],
                            "scope_reference": narrative['scope_reference'],
                            "chunk_index": chunk_idx,
                            "source_type": "structured_data_narrative"
                        }
                    }],
                    collection_id=collection_id
                )
                chunk_ids.extend(response['chunk_ids'])
            
            # Store narrative in database
            narrative_record = await self.supabase.table('data_narratives').insert({
                **narrative,
                'confidence_score': 0.95  # High confidence for generated narratives
            }).execute()
            
            # Link narrative to chunks
            for chunk_id in response['chunk_ids']:
                await self.supabase.table('narrative_data_links').insert({
                    'narrative_id': narrative_record.data[0]['id'],
                    'chunk_id': chunk_id,
                    'link_type': 'describes',
                    'relevance_score': 1.0
                }).execute()
        
        return chunk_ids
```

## 3. Query Handler for Structured Data

```python
# structured_query_handler.py
class StructuredDataQueryHandler:
    """
    Handles queries against structured data with narrative context
    """
    
    def __init__(self, r2r_adapter, supabase_client):
        self.r2r = r2r_adapter
        self.supabase = supabase_client
    
    async def query_with_data_context(
        self,
        query: str,
        user_id: str,
        include_raw_data: bool = False
    ) -> Dict[str, Any]:
        """
        Query that retrieves both narrative and raw data
        """
        # Step 1: Search narratives using RAG
        narrative_results = await self.r2r.search_with_rls(
            query=query,
            user_id=user_id,
            search_settings={
                'filters': {
                    'metadata.source_type': {'$eq': 'structured_data_narrative'}
                }
            }
        )
        
        # Step 2: Get linked structured data
        structured_data = []
        if include_raw_data and narrative_results['results']:
            for result in narrative_results['results'][:5]:
                # Get linked data IDs
                links = await self.supabase.table('narrative_data_links').select(
                    'structured_data_ids'
                ).eq('chunk_id', result['chunk_id']).execute()
                
                if links.data and links.data[0]['structured_data_ids']:
                    # Fetch actual data
                    data = await self.supabase.table('structured_data').select(
                        '*'
                    ).in_('id', links.data[0]['structured_data_ids']).execute()
                    
                    structured_data.extend(data.data)
        
        # Step 3: Format response with both narrative and data
        response = await self._generate_integrated_response(
            query,
            narrative_results,
            structured_data
        )
        
        return response
    
    async def _generate_integrated_response(
        self,
        query: str,
        narrative_results: Dict[str, Any],
        structured_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Generate response that integrates narrative and data
        """
        # Convert structured data back to table format for display
        if structured_data:
            df_display = self._long_to_wide_format(structured_data)
        else:
            df_display = None
        
        # Create context for LLM
        context = {
            'narratives': [r['text'] for r in narrative_results['results'][:5]],
            'data_sample': df_display.to_dict('records')[:10] if df_display is not None else None
        }
        
        prompt = f"""Answer this question using both the narrative descriptions and actual data:
        
        Question: {query}
        
        Narrative Context:
        {json.dumps(context['narratives'], indent=2)}
        
        Data Sample:
        {json.dumps(context['data_sample'], indent=2) if context['data_sample'] else 'No raw data available'}
        
        Provide a comprehensive answer that:
        1. References specific data points when relevant
        2. Uses the narrative context for interpretation
        3. Clearly distinguishes between narrative insights and raw data facts
        4. Includes any relevant calculations or comparisons
        """
        
        response = await self._call_llm(prompt)
        
        return {
            'answer': response,
            'narrative_sources': narrative_results['results'],
            'data_sample': context['data_sample'],
            'has_structured_data': df_display is not None
        }
    
    def _long_to_wide_format(
        self, 
        long_data: List[Dict[str, Any]]
    ) -> pd.DataFrame:
        """
        Convert long format back to wide format for display
        """
        if not long_data:
            return pd.DataFrame()
        
        # Group by row_id
        rows = {}
        for record in long_data:
            row_id = record['row_id']
            if row_id not in rows:
                rows[row_id] = {}
            rows[row_id][record['column_name']] = record['column_value']
        
        # Convert to DataFrame
        df = pd.DataFrame.from_dict(rows, orient='index')
        df.index.name = 'row_id'
        
        return df
```

## 4. Frontend Components for Structured Data

```tsx
// components/StructuredDataViewer.tsx
import { useState, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface StructuredDataResponse {
  answer: string
  narrative_sources: any[]
  data_sample: Record<string, any>[]
  has_structured_data: boolean
}

export function StructuredDataViewer({ 
  response 
}: { 
  response: StructuredDataResponse 
}) {
  const [selectedView, setSelectedView] = useState<'narrative' | 'data' | 'hybrid'>('hybrid')
  
  return (
    <div className="space-y-6">
      <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)}>
        <TabsList>
          <TabsTrigger value="hybrid">Integrated View</TabsTrigger>
          <TabsTrigger value="narrative">Narrative</TabsTrigger>
          <TabsTrigger value="data">Raw Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hybrid">
          <HybridView response={response} />
        </TabsContent>
        
        <TabsContent value="narrative">
          <NarrativeView sources={response.narrative_sources} />
        </TabsContent>
        
        <TabsContent value="data">
          <DataTableView data={response.data_sample} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function HybridView({ response }: { response: StructuredDataResponse }) {
  return (
    <div className="space-y-4">
      {/* Answer with integrated context */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
          <CardDescription>
            Integrated narrative and data insights
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            {response.answer}
          </div>
        </CardContent>
      </Card>
      
      {/* Key data points highlighted */}
      {response.has_structured_data && (
        <Card>
          <CardHeader>
            <CardTitle>Supporting Data</CardTitle>
          </CardHeader>
          <CardContent>
            <DataHighlights data={response.data_sample} />
          </CardContent>
        </Card>
      )}
      
      {/* Narrative context */}
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
        </CardHeader>
        <CardContent>
          {response.narrative_sources.map((source, idx) => (
            <div key={idx} className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-700">{source.text}</p>
              <p className="text-xs text-gray-500 mt-2">
                Type: {source.metadata?.narrative_type} | 
                Scope: {source.metadata?.scope}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function DataTableView({ data }: { data: Record<string, any>[] }) {
  if (!data || data.length === 0) {
    return <div>No data available</div>
  }
  
  const columns = Object.keys(data[0])
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(col => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={idx}>
              {columns.map(col => (
                <TableCell key={col}>
                  {formatCellValue(row[col])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DataHighlights({ data }: { data: Record<string, any>[] }) {
  // Extract numeric columns for visualization
  const numericColumns = data.length > 0 
    ? Object.keys(data[0]).filter(key => 
        typeof data[0][key] === 'number'
      )
    : []
  
  if (numericColumns.length === 0) {
    return <div>No numeric data to visualize</div>
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {numericColumns.slice(0, 2).map(col => (
        <Card key={col}>
          <CardHeader>
            <CardTitle className="text-sm">{col}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="row_id" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey={col} 
                  stroke="#8884d8" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'number') {
    return value.toLocaleString(undefined, {
      maximumFractionDigits: 2
    })
  }
  if (typeof value === 'boolean') return value ? '✓' : '✗'
  return String(value)
}
```

## 5. Example Use Case: Financial Data

Let's say you ingest a CSV of quarterly financial results:

```csv
Quarter,Revenue,Expenses,Profit,Growth_Rate
Q1-2023,1000000,800000,200000,0.05
Q2-2023,1050000,820000,230000,0.05
Q3-2023,1100000,850000,250000,0.048
Q4-2023,1200000,900000,300000,0.091
```

The system would:

### 1. Create Long Table:
```
| document_id | row_id | column_name | column_value |
|------------|--------|-------------|--------------|
| doc-123    | 0      | Quarter     | Q1-2023      |
| doc-123    | 0      | Revenue     | 1000000      |
| doc-123    | 0      | Expenses    | 800000       |
| ...        | ...    | ...         | ...          |
```

### 2. Generate Narratives:
- **Summary**: "This financial dataset covers four quarters of 2023, showing steady revenue growth from $1M to $1.2M..."
- **Trend Analysis**: "Revenue shows consistent upward trajectory with 20% total growth over the year..."
- **Anomaly Detection**: "Q4 shows unusually high growth rate of 9.1% compared to average 5%..."

### 3. Link Everything:
When users query "What was our best performing quarter?", the system:
- Retrieves the Q4 narrative chunk
- Fetches linked raw data rows
- Presents both narrative ("Q4 showed exceptional performance...") and data table

## Benefits of This Approach

1. **Natural Language Queries Work**: Users can ask questions in plain English
2. **Context Preservation**: Narratives explain what the numbers mean
3. **Drill-Down Capability**: Can go from narrative to specific data points
4. **Better Retrieval**: Narratives are more semantic-search friendly than raw numbers
5. **Audit Trail**: Every narrative links back to source data

This is exactly the kind of sophisticated approach that makes structured data truly useful in RAG systems. The "long table + narrative" pattern is becoming a best practice for enterprise RAG implementations dealing with financial data, operational metrics, or any tabular data that needs to be queried naturally.