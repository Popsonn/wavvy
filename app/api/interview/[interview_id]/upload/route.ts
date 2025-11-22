import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { saveRecording, getCandidate } from '@/lib/db';

export const runtime = 'nodejs';
// Increase duration for slower connections
export const maxDuration = 60; 

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const body = await req.json() as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // 1. Validate candidate exists
        const { searchParams } = new URL(req.url);
        const candidateId = searchParams.get('candidate_id');
        const questionIndex = searchParams.get('question_index');

        if (!candidateId) throw new Error('Candidate ID is required');

        const candidate = await getCandidate(interview_id, candidateId);
        if (!candidate) throw new Error('Candidate not found');

        // 2. SECURITY: Validate Content Types
        // We allow webm (Chrome/Firefox) and mp4 (Safari/iOS)
        // We also allow the detailed codec versions
        return {
          allowedContentTypes: [
            'video/webm', 
            'video/mp4', 
            'video/webm;codecs=vp8,opus', 
            'video/quicktime' // Sometimes iOS sends this
          ],
          tokenPayload: JSON.stringify({
            interview_id,
            candidate_id: candidateId,
            question_index: questionIndex,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = JSON.parse(tokenPayload || '{}');
          
          // 3. Save to Database
          await saveRecording(
            payload.interview_id,
            payload.candidate_id,
            {
              question_index: parseInt(payload.question_index),
              video_url: blob.url,
              duration: 0,
              uploaded_at: new Date().toISOString(),
            }
          );
          
          console.log(`[Upload Success] Saved ${blob.url} for candidate ${payload.candidate_id}`);
        } catch (error) {
          // Crucial: Log this error. If DB save fails, we have an orphaned video file.
          console.error('Failed to save recording metadata to DB:', error);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload video' },
      { status: 500 }
    );
  }
}

// GET method remains the same...
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
    // ... (Your existing GET code is fine)
    try {
    const { interview_id } = await params;
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidate_id');
 
    if (!candidateId) {
      return NextResponse.json(
        { error: 'candidate_id query parameter is required' },
        { status: 400 }
      );
    }
 
    const { getRecordings } = await import('@/lib/db');
    const recordings = await getRecordings(interview_id, candidateId);
 
    return NextResponse.json({ recordings });
  } catch (error: any) {
    console.error('Get recordings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recordings' },
      { status: 500 }
    );
  }
}