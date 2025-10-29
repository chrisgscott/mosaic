# LLM Model Pricing Reference (October 2025)

## Quick Reference Table - Cost per 100-page Document
*Assuming 5,000 input tokens + 50,000 output tokens*

| Rank | Model | Provider | Input $/M | Output $/M | Cost/100pg | Blog Posts/$1 |
|------|-------|----------|-----------|------------|------------|---------------|
| 1 | gpt-5-nano | OpenAI | $0.05 | $0.40 | $0.02 | 714 |
| 2 | gpt-4.1-nano | OpenAI | $0.10 | $0.40 | $0.02 | 714 |
| 3 | gpt-4o-mini | OpenAI | $0.15 | $0.60 | $0.03 | 476 |
| 4 | gpt-4.1-mini | OpenAI | $0.40 | $1.60 | $0.08 | 182 |
| 5 | gpt-5-mini | OpenAI | $0.25 | $2.00 | $0.10 | 147 |
| 6 | Gemini 2.5 Flash | Google | $0.30 | $2.50 | $0.13 | 119 |
| 7 | o4-mini | OpenAI | $1.10 | $4.40 | $0.23 | 67 |
| 8 | o3-mini | OpenAI | $1.10 | $4.40 | $0.23 | 67 |
| 9 | Claude Haiku 4.5 | Anthropic | $1.00 | $5.00 | $0.25 | 59 |
| 10 | gpt-4.1 | OpenAI | $2.00 | $8.00 | $0.41 | 37 |
| 11 | o3 | OpenAI | $2.00 | $8.00 | $0.41 | 37 |
| 12 | o4-mini-deep-research | OpenAI | $2.00 | $8.00 | $0.41 | 37 |
| 13 | gpt-5 | OpenAI | $1.25 | $10.00 | $0.51 | 30 |
| 14 | Gemini 2.5 Pro | Google | $1.25 | $10.00 | $0.51 | 30 |
| 15 | Claude Sonnet 4.5 | Anthropic | $3.00 | $15.00 | $0.77 | 20 |
| 16 | Claude Sonnet 4.5 (1M) | Anthropic | $3.00 | $15.00 | $0.77 | 20 |
| 17 | o3-deep-research | OpenAI | $10.00 | $40.00 | $2.05 | 7 |
| 18 | gpt-5-pro | OpenAI | $15.00 | $120.00 | $6.08 | 2 |

## Model Selection by Use Case

### Ultra-Budget Tier (<$0.05 per 100-page doc)
- **gpt-5-nano**: Classification, auto-complete, bulk tagging, simple Q&A
- **gpt-4.1-nano**: Email categorization, sentiment analysis, data extraction
- **gpt-4o-mini**: Customer service, FAQ responses, social media content

### Budget Tier ($0.05-$0.15)
- **gpt-4.1-mini**: Code comments, PR reviews, technical documentation
- **gpt-5-mini**: Blog writing, marketing copy, basic code generation
- **Gemini 2.5 Flash**: Real-time apps, streaming, multimodal (image+text)

### Mid-Tier ($0.20-$0.50)
- **o4-mini/o3-mini**: Quick reasoning, math help, logical problems
- **Claude Haiku 4.5**: Production chatbots, content rewriting, parallel processing
- **gpt-4.1**: Full-stack coding, complex SQL, 1M token context
- **o3**: STEM problems, debugging, mathematical proofs
- **o4-mini-deep-research**: Literature reviews, market research with citations

### Premium Tier ($0.50-$1.00)
- **gpt-5**: Production coding, creative writing, agentic workflows
- **Gemini 2.5 Pro**: Long-context (1M tokens), enterprise apps, Google Search grounding
- **Claude Sonnet 4.5**: Software architecture, nuanced writing, computer use

### Ultra-Premium (>$2.00)
- **o3-deep-research**: PhD-level research, comprehensive reports, investigative journalism
- **gpt-5-pro**: Mission-critical reasoning, legal/medical analysis, frontier capabilities

## Quick Calculations

### 2,500-word Blog Post Costs
- Input: 267 tokens (200-word prompt)
- Output: 3,333 tokens (2,500 words)

| Model | Cost per Post | Posts per Dollar |
|-------|--------------|------------------|
| gpt-5-nano | $0.0014 | 714 |
| gpt-5-mini | $0.0068 | 147 |
| gpt-5 | $0.0337 | 30 |
| gpt-5-pro | $0.4041 | 2.5 |

### Token Estimation Rules
- 1 word ≈ 1.33 tokens
- 1 page (double-spaced) ≈ 250 words ≈ 333 tokens
- 1 page (standard) ≈ 350 words ≈ 467 tokens
- 1 page (academic/dense) ≈ 500 words ≈ 667 tokens

## Mosaic Project Recommendations

| Use Case | Recommended Model | Cost | Alternative |
|----------|------------------|------|-------------|
| Deep Research | o3 | $0.41/100pg | o4-mini-deep-research (with citations) |
| Detailed Analysis | gpt-5 | $0.51/100pg | Claude Sonnet 4.5 (for nuanced tasks) |
| Embeddings | text-embedding-3-small | $0.02/M | Already optimal |
| Quick Tasks | gpt-5-nano | $0.0014/task | gpt-4.1-nano |
| Standard Tasks | gpt-5-mini | $0.10/100pg | gpt-4o-mini (70% cheaper) |
| Summarization | gpt-4.1-mini | $0.08/100pg | gpt-5-mini (better quality) |
| Vision/Multimodal | Gemini 2.5 Flash | $0.13/100pg | gpt-5 (better OCR accuracy) |

## Cost Optimization Strategies

1. **Model Ladder Approach**
   - Start with nano/mini models (90% of tasks)
   - Escalate to standard only when needed
   - Reserve premium for true complexity
   - Keep deep-research for critical insights only

2. **Batch Processing**
   - Use Batch API for 50% discount on non-urgent tasks
   - Available for most OpenAI models

3. **Caching (Prompt Caching)**
   - **GPT-4.1 family**: 75% discount on cached input tokens
   - **GPT-5 family**: 75% discount on cached input tokens (assumed similar)
   - Applies to repeated system prompts, context, and instructions
   - Structure prompts with common prefixes to maximize caching
   - Example: 400K cached tokens at $0.40/M → $0.10/M (75% off)

4. **Expected Cost Reduction**
   - Using recommended tier system: 85-90% cost reduction vs all-premium
   - Example: $100/month = ~29,000 operations vs ~400 with gpt-5-pro

## Key Insights
- **304x price difference** between cheapest (nano) and most expensive (gpt-5-pro)
- **Sweet spot for quality/cost**: gpt-5-mini or gpt-4.1-mini
- **Best value for reasoning**: o3 (not deep-research variant)
- **Best for massive context**: gpt-4.1, Claude Sonnet, or Gemini Pro (all support 1M+ tokens)

Last Updated: October 2025
Source: Official OpenAI, Anthropic, and Google pricing documentation