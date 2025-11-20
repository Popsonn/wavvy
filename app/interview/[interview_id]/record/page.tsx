'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import VideoRecorder from '@/components/VideoRecorder';

interface InterviewData {
  job_title: string;
  questions: string[];
}

interface CandidateData {
  question_order: number[];
}

export default function RecordPage({
  params,
}: {
  params: Promise<{ interview_id: string }>;
}) {
  const unwrappedParams = use(params);
  const interview_id = unwrappedParams.interview_id;

  const router = useRouter();
  const searchParams = useSearchParams();
  const candidateId = searchParams.get('candidate_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interview, setInterview] = useState<InterviewData | null>(null);
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [backgroundUploadError, setBackgroundUploadError] = useState('');
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);

  useEffect(() => {
    if (!candidateId) {
      router.push(`/interview/${interview_id}/register`);
    }
  }, [candidateId, interview_id, router]);

  // Total elapsed time tracker
  useEffect(() => {
    const timer = setInterval(() => {
      setTotalElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch interview
        const interviewResponse = await fetch(`/api/interview/${interview_id}`);
        if (!interviewResponse.ok) {
          throw new Error('Interview not found');
        }
        const interviewData = await interviewResponse.json();
        setInterview(interviewData);

        // Fetch candidate data (to get question order)
        const candidateResponse = await fetch(
          `/api/interview/${interview_id}/candidate?candidate_id=${candidateId}`
        );
        if (!candidateResponse.ok) {
          throw new Error('Candidate not found');
        }
        const candidateData = await candidateResponse.json();
        setCandidate(candidateData);

      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    
    if (candidateId) {
      fetchData();
    }
  }, [interview_id, candidateId]);

  const handleRecordingComplete = (blob: Blob) => {
    setRecordedBlob(blob);
    setError('');
    setBackgroundUploadError('');
  };

  const uploadVideo = async (blob: Blob, originalQuestionIndex: number): Promise<boolean> => {
    try {
      const filename = `interviews/${interview_id}/${candidateId}/question-${originalQuestionIndex}.webm`;
      
      // Use client-side upload
      const { upload } = await import('@vercel/blob/client');
      
      const newBlob = await upload(filename, blob, {
        access: 'public',
        handleUploadUrl: `/api/interview/${interview_id}/upload?candidate_id=${candidateId}&question_index=${originalQuestionIndex}`,
      });

      console.log('Upload successful:', newBlob.url);
      setUploadedCount(prev => prev + 1);
      return true;
    } catch (err) {
      console.error('Upload error:', err);
      const message = err instanceof Error ? err.message : 'Upload failed';
      setBackgroundUploadError(message);
      return false;
    }
  };

  const handleNext = async () => {
    if (!recordedBlob || !candidateId || !interview || !candidate) return;

    setUploading(true);
    setError('');
    setBackgroundUploadError('');

    const currentBlob = recordedBlob;
    const questionOrder = candidate.question_order || [];
    const originalQuestionIndex = questionOrder[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex >= questionOrder.length - 1;

    if (isLastQuestion) {
      const uploadSuccess = await uploadVideo(currentBlob, originalQuestionIndex);
      
      if (uploadSuccess) {
        router.push(`/interview/${interview_id}/complete?candidate_id=${candidateId}`);
      } else {
        setError('Failed to upload final answer. Please try again.');
        setUploading(false);
      }
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      setRecordedBlob(null);
      setUploading(false);

      uploadVideo(currentBlob, originalQuestionIndex).then(success => {
        if (!success) {
          setBackgroundUploadError(
            `Question ${currentQuestionIndex + 1} upload failed. Retrying in background...`
          );
        }
      });
    }
  };

  const formatTotalTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#667eea] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a
            href={`/interview/${interview_id}`}
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg hover:shadow-lg transition-all"
          >
            Back to Interview
          </a>
        </div>
      </div>
    );
  }

  if (!interview || !candidate) return null;

  // Get questions in randomized order
  const questionOrder = candidate.question_order || 
    Array.from({ length: interview.questions.length }, (_, i) => i); 
  
  const currentQuestion = interview.questions[questionOrder[currentQuestionIndex]];
  const totalQuestions = questionOrder.length;
  const progress = ((uploadedCount) / totalQuestions) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {backgroundUploadError && (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-l-4 border-yellow-400 p-3 mb-3 rounded-lg shadow-sm">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 font-medium">{backgroundUploadError}</p>
              </div>
            </div>
          </div>
        )}

        {/* INDUSTRY-STANDARD COMPACT HEADER */}
        <div className="bg-white rounded-xl shadow-sm px-5 py-3 mb-3">
          
          {/* Top Line: Title + Status + Timer */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-semibold text-gray-900">
                {interview.job_title}
              </h1>
              {uploading && (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">
                  <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse"></div>
                  Processing
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Question Counter */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 font-medium">Question</span>
                <span className="font-bold text-gray-900">
                  {currentQuestionIndex + 1}/{totalQuestions}
                </span>
              </div>
              
              {/* Timer - Industry standard: top right */}
              <div className="flex items-center gap-1.5 text-sm font-mono font-semibold text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formatTotalTime(totalElapsedTime)}</span>
              </div>
            </div>
          </div>

          {/* Progress Bar - Thin and modern */}
          <div className="relative w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#667eea] to-[#764ba2] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
            </div>
          </div>
          
          {/* Subtle progress text */}
          <p className="text-xs text-gray-500 text-right mt-1.5 font-medium">
            {uploadedCount} of {totalQuestions} uploaded
          </p>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-4">
          <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
            
            {/* Question Display */}
            <div className="lg:w-2/5 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Current Question:</h2>
              <div className="flex-1 p-5 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border-2 border-purple-100 flex items-start">
                <p className="text-gray-800 text-lg leading-relaxed font-medium">
                  {currentQuestion.replace(/^\d+\.\s*/, '')}
                </p>
              </div>
              <p className="text-sm text-gray-600 mt-3 flex items-start">
                <span className="mr-2 mt-0.5">💡</span>
                <span>Tip: Take your time to think before recording. You have up to 3 minutes per question.</span>
              </p>
            </div>

            {/* Video Recorder */}
            <div className="lg:w-3/5 flex flex-col">
              <VideoRecorder 
                key={currentQuestionIndex}
                onRecordingComplete={handleRecordingComplete}
                maxDuration={180}
              />
            </div>
            
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
                router.push(`/interview/${interview_id}`);
              }
            }}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            ← Exit Interview
          </button>

          <div className="flex space-x-3">
            <button
              onClick={handleNext}
              disabled={!recordedBlob || uploading}
              className="px-8 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-semibold rounded-lg hover:shadow-xl transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg transform hover:scale-[1.02] active:scale-100"
            >
              {uploading ? (
                <span className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </span>
              ) : currentQuestionIndex >= totalQuestions - 1 ? (
                'Submit Interview →'
              ) : (
                'Next Question →'
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && interview && (
          <div className="mt-4 p-4 bg-gradient-to-br from-red-50 to-red-100 border-l-4 border-red-500 text-red-700 rounded-lg text-sm shadow-sm">
            <p className="font-semibold mb-1">Error</p>
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}