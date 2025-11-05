/**
 * Initialization endpoint for AI models
 * This should be called during application startup to cache models
 */

import { initModels } from '@/lib/ai/gateway';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await initModels();
    return NextResponse.json({ 
      success: true, 
      message: 'AI models initialized successfully' 
    });
  } catch (error) {
    console.error('[Init] Failed to initialize models:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize models',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
