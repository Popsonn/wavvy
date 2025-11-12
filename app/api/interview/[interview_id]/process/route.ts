import { NextRequest, NextResponse } from 'next/server';
import { getInterview, getRecordings, saveInterviewResults, getCandidate } from '@/lib/db';
import { transcribeMultipleVideos } from '@/lib/transcription';
import { scoreInterview } from '@/lib/scoring';

export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ interview_id: string }> }
) {
  try {
    const { interview_id } = await params;
    const { candidate_id } = await req.json();

    if (!candidate_id) {
      return NextResponse.json(
        { error: 'candidate_id is required' },
        { status: 400 }
      );
    }

    const candidate = await getCandidate(interview_id, candidate_id);
    
    if (!candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    if (candidate.status === 'scored') {
      return NextResponse.json({
        success: true,
        message: 'Interview already processed',
        alreadyProcessed: true,
        results: candidate.results ? {
          overallScore: candidate.results.overallScore,
          questionsProcessed: candidate.results.questionScores.length,
          topStrengths: candidate.results.topStrengths,
          areasToImprove: candidate.results.areasToImprove,
        } : null,
      });
    }

    const interview = await getInterview(interview_id);
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }

    const recordings = await getRecordings(interview_id, candidate_id);
    if (!recordings || recordings.length === 0) {
      return NextResponse.json(
        { error: 'No recordings found' },
        { status: 404 }
      );
    }

    const sortedRecordings = recordings.sort(
      (a, b) => a.question_index - b.question_index
    );

    const videoUrls = sortedRecordings.map(r => r.video_url);

    const transcripts = await transcribeMultipleVideos(videoUrls);

    const scoringResult = await scoreInterview(
      interview.questions,
      transcripts,
      {
        jobTitle: interview.job_title,
        seniority: interview.seniority,
        industry: interview.industry,
        roleTemplate: interview.role_template,
        keyResponsibilities: interview.key_responsibilities || [],
        requiredSkills: interview.required_skills || [],
      },
      {
        yearsExperience: candidate.years_experience,
        candidateName: candidate.name,
      }
    );

    await saveInterviewResults(interview_id, candidate_id, {
      transcripts,
      questionScores: scoringResult.questionScores,
      overallScore: scoringResult.overallScore,
      overallFeedback: scoringResult.overallFeedback,
      topStrengths: scoringResult.topStrengths,
      areasToImprove: scoringResult.areasToImprove,
      processedAt: new Date().toISOString(),
    });

    try {
      const { sendCandidateConfirmationEmail } = await import('@/lib/email');
      
      await sendCandidateConfirmationEmail({
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        jobTitle: interview.job_title,
        questionsCount: recordings.length,
        submittedDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
      });
    } catch (emailError) {
      // Non-blocking: email failure doesn't stop processing
    }

    let sheetUrl = '';
    try {
      const { exportToGoogleSheets } = await import('@/lib/sheets');
      
      sheetUrl = await exportToGoogleSheets(
        interview_id,
        interview.job_title,
        {
          candidate,
          interview,
          results: {
            overallScore: scoringResult.overallScore,
            overallFeedback: scoringResult.overallFeedback,
            topStrengths: scoringResult.topStrengths,
            areasToImprove: scoringResult.areasToImprove,
            questionScores: scoringResult.questionScores,
          },
          recordings: sortedRecordings,
        }
      );
    } catch (sheetsError) {
      sheetUrl = 'https://sheets.google.com';
    }

    try {
      const { sendRecruiterResultsEmail } = await import('@/lib/email');
      const recruiterEmail = process.env.RECRUITER_EMAIL || 'recruiter@company.com';
      
      await sendRecruiterResultsEmail({
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        jobTitle: interview.job_title,
        overallScore: scoringResult.overallScore,
        topStrengths: scoringResult.topStrengths,
        areasToImprove: scoringResult.areasToImprove,
        sheetUrl,
        recruiterEmail,
      });
    } catch (emailError) {
      // Non-blocking: email failure doesn't stop processing
    }

    return NextResponse.json({
      success: true,
      message: 'Interview processed successfully',
      results: {
        overallScore: scoringResult.overallScore,
        questionsProcessed: recordings.length,
        topStrengths: scoringResult.topStrengths,
        areasToImprove: scoringResult.areasToImprove,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process interview';
    return NextResponse.json(
      { 
        error: 'Failed to process interview',
        details: message,
      },
      { status: 500 }
    );
  }
}