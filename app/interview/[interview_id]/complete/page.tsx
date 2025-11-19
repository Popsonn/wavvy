'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

interface CandidateData {
  name: string;
  email: string;
  status?: string;
  registered_at?: string;
  recordings?: Array<{ question_index: number; uploaded_at: string }>;
}

interface InterviewData {
  job_title: string;
  questions: string[];
}

export default function CompletePage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const unwrappedParams = use(params);
  const interview_id = unwrappedParams.interview_id;

  const searchParams = useSearchParams();
  const candidateId = searchParams.get('candidate_id');
  
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const initializationStarted = useRef(false);

  useEffect(() => {
    async function initialize() {
      if (!candidateId) {
        setLoading(false);
        return;
      }

      if (initializationStarted.current) {
        return;
      }
      
      initializationStarted.current = true;

      try {
        const candidateResponse = await fetch(
          `/api/interview/${interview_id}/candidate?candidate_id=${candidateId}`
        );
        
        if (!candidateResponse.ok) {
          throw new Error('Failed to fetch candidate data');
        }

        const candidateData: CandidateData = await candidateResponse.json();
        setCandidate(candidateData);

        const interviewResponse = await fetch(`/api/interview/${interview_id}`);
        if (interviewResponse.ok) {
          const interviewData = await interviewResponse.json();
          setInterview(interviewData);
        }

        if (candidateData.status === 'scored') {
          setLoading(false);
          return;
        }

        if (candidateData.status === 'submitted') {
          setLoading(false);
          return;
        }

        const statusResponse = await fetch(
          `/api/interview/${interview_id}/candidate/status`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidate_id: candidateId,
              status: 'submitted',
            }),
          }
        );

        if (!statusResponse.ok) {
          console.warn('Failed to update status');
        }
        
        fetch(`/api/interview/${interview_id}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate_id: candidateId }),
        }).catch(err => console.error('Background processing error:', err));
        
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [interview_id, candidateId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#667eea] mx-auto mb-4"></div>
          <p className="text-gray-600">Finalizing your submission...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Interview Submitted Successfully!
          </h1>
          
          {candidate && (
            <p className="text-xl text-gray-600 mb-8">
              Thank you, <span className="font-semibold text-gray-800">{candidate.name}</span>!
            </p>
          )}

          {interview && (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-5 mb-8 border-2 border-purple-100">
              <p className="text-sm text-gray-600 mb-1">Position Applied For</p>
              <p className="text-lg font-semibold text-gray-900">{interview.job_title}</p>
              <p className="text-sm text-gray-600 mt-2">
                {interview.questions.length} questions completed
              </p>
            </div>
          )}

          {candidate?.status === 'scored' && (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 mb-6 border-2 border-green-200">
              <p className="text-green-800 text-sm font-medium">
                ✓ Your interview has already been processed and reviewed.
              </p>
            </div>
          )}

          {candidate?.status === 'submitted' && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 mb-6 border-2 border-blue-200">
              <p className="text-blue-800 text-sm font-medium">
                🤖 Your interview is currently being processed. You'll receive an email once complete.
              </p>
            </div>
          )}

          <div className="border-t-2 border-gray-100 my-8"></div>

          <div className="text-left">
            <h2 className="text-xl font-semibold text-gray-900 mb-5">
              What happens next?
            </h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-full flex items-center justify-center font-semibold mr-4 shadow-sm">
                  1
                </div>
                <div className="pt-1">
                  <p className="text-gray-800 font-semibold">
                    Your interview is under review
                  </p>
                  <p className="text-gray-600 text-sm mt-0.5">
                    Our team is carefully evaluating your responses
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-full flex items-center justify-center font-semibold mr-4 shadow-sm">
                  2
                </div>
                <div className="pt-1">
                  <p className="text-gray-800 font-semibold">
                    Check your email
                  </p>
                  {candidate && (
                    <p className="text-gray-600 text-sm mt-0.5">
                      We'll send confirmation and next steps to <strong className="text-gray-800">{candidate.email}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-gray-100 my-8"></div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border-2 border-blue-100">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Confirmation Email
            </h3>
            <p className="text-blue-800 text-sm">
              You will receive a confirmation email shortly with your interview details. 
              If you don't see it soon, please check your spam folder.
            </p>
          </div>

          <p className="text-lg text-gray-500 mt-8 font-medium">
            You can safely close this tab now
          </p>
        </div>

        <div className="text-center mt-8 text-sm text-gray-600">
          <p>
            Questions about your interview?{' '}
            <a href="mailto:support@company.com" className="text-[#667eea] hover:text-[#764ba2] font-medium transition-colors">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}