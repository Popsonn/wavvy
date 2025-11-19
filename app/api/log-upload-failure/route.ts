import { NextRequest, NextResponse } from 'next/server';

interface UploadFailureLog {
  interview_id: string;
  candidate_id: string;
  question_index?: number;
  pending_uploads?: number;
  error?: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: UploadFailureLog = await req.json();
    
    // Validate required fields
    if (!body.interview_id || !body.candidate_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Just log to console (enough for MVP!)
    console.error('📤 Upload Failure:', {
      interview: body.interview_id,
      candidate: body.candidate_id,
      question: body.question_index,
      pending: body.pending_uploads,
      error: body.error,
      timestamp: body.timestamp,
      userAgent: req.headers.get('user-agent'),
    });
    
    // TODO Production: Send to Sentry, LogRocket, or monitoring service
    // await sendToMonitoring(body);
    
    return NextResponse.json({ 
      success: true,
      message: 'Logged' 
    });
    
  } catch (error) {
    console.error('Failed to log upload failure:', error);
    
    // Don't fail - logging is non-critical
    return NextResponse.json({ 
      success: false,
      error: 'Logging failed, but non-critical' 
    }, { status: 200 });
  }
}