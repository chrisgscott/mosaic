# Mosaic Documentation

**Welcome to the Mosaic Knowledge Platform documentation.** This hub provides access to core documentation for the universal knowledge platform.

---

## 🚀 Quick Start

### For Users
1. **[API Documentation](./API.md)** - Complete integration guide for external tools
2. **[Getting Started Guide](./guides/getting_started.md)** - Set up your development environment

### For Developers
1. **[API Documentation](./API.md)** - REST API reference and examples
2. **[Architecture Overview](./architecture/)** - System design and patterns
3. **[Technical References](./reference/)** - Implementation details

---

## 📚 Core Documentation

### 🎯 [API Documentation](./API.md)
**Essential for all users and developers**
- Complete REST API reference
- Authentication methods (API key + session)
- Request/response formats
- Feature control parameters
- Examples in curl, JavaScript, and Python
- Best practices and performance tips

### 🏗️ [Architecture](./architecture/)
System design and technical architecture
- **Core Principles** - Knowledge platform fundamentals
- **Ingestion Pipeline** - Document processing flow
- **Search Architecture** - Hybrid search implementation
- **Database Schema** - Supabase and pgvector design

### 📖 [Guides](./guides/)
User and developer documentation
- **Getting Started** - Development setup and onboarding
- **Deployment Guide** - Production deployment instructions

### 📋 [Reference](./reference/)
Technical references and implementation guides
- **RAG Best Practices** - Implementation patterns
- **AI SDK Patterns** - Vercel AI SDK integration
- **Chunk Metadata** - Data structure reference
- **LLM Pricing** - Cost optimization strategies
- **Performance Tuning** - Optimization techniques

### 📦 [Archive](./archive/)
Historical documentation and project-specific files
- Previous implementation details
- Project-specific documentation
- Superseded design documents

---

## 🎯 Key Concepts

### Core Technologies
- **Supabase:** Postgres-native database with pgvector
- **Vercel AI SDK:** Streaming chat and model management
- **Docling:** VLM-powered document extraction
- **OpenAI:** Primary LLM with structured outputs
- **Cohere:** Search reranking for precision

### Key Features
- **Universal API:** RESTful search with authentication
- **Hybrid Search:** Semantic + BM25 + Graph + Reranking
- **Smart Chunking:** Structure-aware with multiple strategies
- **Knowledge Graph:** Entity extraction and relationship mapping
- **Real-time Processing:** Async document processing
- **Multi-tenant:** Row-level security and user isolation

---

## 🔍 Finding Information

### By Role
- **API User:** API Documentation
- **Developer:** API Documentation + Architecture + Reference
- **System Administrator:** Architecture + Deployment Guide

### By Task
- **Integrate with API:** API Documentation
- **Understand Architecture:** Architecture section
- **Deploy System:** Deployment Guide
- **Optimize Performance:** Reference section

### By Topic
- **Search API:** API Documentation
- **Document Processing:** Architecture → Ingestion Pipeline
- **Database Design:** Architecture → Database Schema
- **Performance Optimization:** Reference → Performance Tuning

---

## 🤝 Getting Help

### Documentation Issues
- Found outdated information? Please create a GitHub issue
- Missing documentation? Please create a GitHub issue
- API questions? Check API Documentation first

### Technical Questions
- Check the API Documentation for integration questions
- Review Architecture section for design questions
- Consult Reference section for implementation details

---

*This documentation is maintained as part of the Mosaic project. Last updated: January 2025*
