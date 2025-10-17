#!/usr/bin/env python3
"""Test GPT-5-nano response structure"""

import os
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv("/Users/chrisgscott/projects/mosaic/deploy/personal/.env")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Test with a simple summary request
response = client.chat.completions.create(
    model="gpt-5-nano",
    messages=[
        {
            "role": "system",
            "content": "Analyze the CURRENT CHUNK in context of its neighbors and write a 2-3 sentences summary. Focus on: (1) the main topic and key concepts, (2) how it connects to surrounding content, and (3) its role in the broader document. Write directly and avoid meta-commentary."
        },
        {
            "role": "user",
            "content": """CURRENT CHUNK:
Strategic Design Approach (SDA) Methodologies
The Strategic Design Approach (SDA) is a suite of methodologies designed to work together as an integrated framework for strategy, planning, and execution. Each methodology has a distinct role, but the greatest value comes from their interactions — where outputs from one become inputs to another."""
        }
    ],
    max_completion_tokens=150
)

print("=" * 80)
print("FULL RESPONSE:")
print(response)
print("=" * 80)
print("\nRESPONSE TYPE:", type(response))
print("\nCHOICES:", response.choices)
print("\nFIRST CHOICE:", response.choices[0] if response.choices else None)
print("\nMESSAGE:", response.choices[0].message if response.choices else None)
print("\nCONTENT:", response.choices[0].message.content if response.choices else None)
print("\nCONTENT TYPE:", type(response.choices[0].message.content) if response.choices else None)
print("=" * 80)
