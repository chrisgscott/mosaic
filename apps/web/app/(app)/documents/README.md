# Document Upload Feature

## Overview
This feature allows users to upload, manage, and delete documents that will be processed for the RAG pipeline.

## Setup

### 1. Run the Database Migration

Apply the migration to create the documents table and storage bucket:

```bash
# From the project root
supabase db push
```

Or manually run the SQL in `/supabase/migrations/20241014_create_documents_table.sql` in your Supabase SQL editor.

### 2. Verify Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to Storage
3. Verify that the `documents` bucket exists
4. The bucket should be **private** (not public)

## Features

### Upload
- **Drag & drop** or click to browse
- **Supported formats**: PDF, TXT, MD, DOC, DOCX
- **Max file size**: 10MB
- **Validation**: File type and size validation before upload
- **User isolation**: Files are stored in user-specific folders (`user_id/filename`)

### Document List
- View all uploaded documents
- See file name, size, status, and upload date
- **Status badges**:
  - `Uploaded`: File successfully uploaded
  - `Processing`: Being processed by RAG pipeline
  - `Ready`: Ready for use in knowledge base
  - `Error`: Processing failed

### Actions
- **Delete**: Remove document from both storage and database
- **Download**: (Coming soon) Download original file

## Database Schema

```sql
documents (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  file_name TEXT,
  file_path TEXT,
  file_size BIGINT,
  file_type TEXT,
  status TEXT CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Storage Structure

```
documents/
└── {user_id}/
    ├── {timestamp}_{filename1}.pdf
    ├── {timestamp}_{filename2}.txt
    └── ...
```

## Security

### Row Level Security (RLS)
- Users can only access their own documents
- All CRUD operations are protected by RLS policies

### Storage Policies
- Users can only upload to their own folder
- Users can only view/delete their own files
- Bucket is private (not publicly accessible)

## Next Steps

1. **Processing Pipeline**: Connect to document processing service
2. **Status Updates**: Update document status as it moves through the pipeline
3. **Download**: Implement document download functionality
4. **Metadata**: Extract and store document metadata
5. **Chunking**: Process documents into chunks for RAG
6. **Embeddings**: Generate embeddings for semantic search
