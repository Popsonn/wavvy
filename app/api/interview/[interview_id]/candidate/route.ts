import { NextRequest, NextResponse } from 'next/server';
import { saveCandidate, getInterview, getCandidate } from '@/lib/db';
import { generateQuestionOrder } from '@/lib/utils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;

    const interview = await getInterview(interview_id);
    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const {
      name,
      email,
      phone,
      years_experience,
      salary_expectations,
      location_confirmed,
      consent_given,
      consent_timestamp,
    } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email?.trim() || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    if (years_experience === undefined || years_experience < 0) {
      return NextResponse.json(
        { error: "Years of experience must be a positive number" },
        { status: 400 }
      );
    }

    if (!salary_expectations?.trim()) {
      return NextResponse.json(
        { error: "Salary expectations are required" },
        { status: 400 }
      );
    }

    // Validate consent
    if (!consent_given) {
      return NextResponse.json(
        { error: "Consent to recording is required" },
        { status: 400 }
      );
    }

    const candidateId = crypto.randomUUID().slice(0, 12);

    // Generate randomized question order for anti-cheating
    const questionOrder = generateQuestionOrder(interview.questions.length);

    const candidateData = {
      interview_id,
      candidate_id: candidateId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || undefined,
      years_experience: Number(years_experience),
      salary_expectations: salary_expectations.trim(),
      location_confirmed: location_confirmed || undefined,
      consent_given: consent_given,
      consent_timestamp: consent_timestamp,
      question_order: questionOrder,
      registered_at: new Date().toISOString(),
      status: 'registered' as const,
    };

    await saveCandidate(interview_id, candidateId, candidateData);

    return NextResponse.json({
      success: true,
      candidate_id: candidateId,
      message: "Registration successful"
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidate_id');

    if (!candidateId) {
      return NextResponse.json(
        { error: "candidate_id query parameter is required" },
        { status: 400 }
      );
    }

    const candidate = await getCandidate(interview_id, candidateId);

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(candidate);

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}