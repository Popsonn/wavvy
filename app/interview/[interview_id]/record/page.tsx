'use client';

import { useState, useEffect, use, useRef } from 'react';
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
  const [resetTrigger, setResetTrigger] = useState(0);
  const [remainingGlobalTime, setRemainingGlobalTime] = useState<number | null>(null);
  const globalTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!candidateId) {
      router.push(`/interview/${interview_id}/register`);
    }
  }, [candidateId, interview_id, router]);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (interview && remainingGlobalTime === null) {
      const TIME_PER_QUESTION = 300;
      const totalTime = interview.questions.length * TIME_PER_QUESTION;
      setRemainingGlobalTime(totalTime);
    }

    if (remainingGlobalTime !== null && remainingGlobalTime > 0) {
      globalTimerRef.current = setInterval(() => {
        setRemainingGlobalTime(prev => {
          if (prev === null || prev <= 0) {
            if (globalTimerRef.current) clearInterval(globalTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (globalTimerRef.current) clearInterval(globalTimerRef.current);
    };
  }, [interview, remainingGlobalTime]);

  useEffect(() => {
    if (remainingGlobalTime === 0) {
      router.push(`/interview/${interview_id}/complete?candidate_id=${candidateId}&reason=timeout`);
    }
  }, [remainingGlobalTime, router, interview_id, candidateId]);

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const interviewResponse = await fetch(`/api/interview/${interview_id}`);
        if (!interviewResponse.ok) throw new Error('Interview not found');
        const interviewData = await interviewResponse.json();
        setInterview(interviewData);

        const candidateResponse = await fetch(
          `/api/interview/${interview_id}/candidate?candidate_id=${candidateId}`
        );
        if (!candidateResponse.ok) throw new Error('Candidate not found');
        const candidateData = await candidateResponse.json();
        setCandidate(candidateData);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    
    if (candidateId) fetchData();
  }, [interview_id, candidateId]);

  const handleRecordingComplete = (blob: Blob) => {
    setRecordedBlob(blob);
    setError('');
    setBackgroundUploadError('');
  };

  const uploadVideo = async (blob: Blob, originalQuestionIndex: number): Promise<boolean> => {
    try {
      const fileExtension = blob.type.includes('mp4') || blob.type.includes('quicktime') 
        ? 'mp4' 
        : 'webm';
      
      const filename = `interviews/${interview_id}/${candidateId}/question-${originalQuestionIndex}.${fileExtension}`;
      
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

    const currentBlob = recordedBlob;
    const questionOrder = candidate.question_order || [];
    const originalQuestionIndex = questionOrder[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex >= questionOrder.length - 1;

    const uploadPromise = uploadVideo(currentBlob, originalQuestionIndex);

    if (isLastQuestion) {
      const success = await uploadPromise;
      if (success) {
        router.push(`/interview/${interview_id}/complete?candidate_id=${candidateId}`);
      } else {
        setError('Failed to upload final answer. Please try again.');
        setUploading(false);
      }
    } else {
      uploadPromise.catch(() => 
        setBackgroundUploadError(`Question ${currentQuestionIndex + 1} failed to upload.`)
      );

      setCurrentQuestionIndex(prev => prev + 1);
      setRecordedBlob(null);
      setUploading(false);
      setResetTrigger(prev => prev + 1);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!interview || !candidate) return null;

  const questionOrder = candidate.question_order || Array.from({ length: interview.questions.length }, (_, i) => i); 
  const currentQuestion = interview.questions[questionOrder[currentQuestionIndex]];
  const totalQuestions = questionOrder.length;
  const isTimeRunningLow = remainingGlobalTime !== null && remainingGlobalTime < 120;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center h-16 shrink-0">
        <div>
           <h1 className="text-sm font-bold text-gray-500 uppercase tracking-wider">{interview.job_title}</h1>
           <p className="text-xs text-gray-400">Candidate ID: {candidateId?.slice(0,8)}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="bg-gray-100 px-3 py-1 rounded-md border border-gray-200 flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${isTimeRunningLow ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
             <span className={`font-mono font-medium transition-colors duration-300 ${isTimeRunningLow ? 'text-red-600 font-bold animate-pulse' : 'text-gray-700'}`}>
               {formatTime(remainingGlobalTime)}
             </span>
          </div>
          <div className="text-right">
             <span className="text-xl font-bold text-[#667eea]">{currentQuestionIndex + 1}</span>
             <span className="text-gray-400 text-sm"> / {totalQuestions}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
         <div className="lg:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
               <h2 className="text-xs font-bold text-blue-800 uppercase mb-1">Current Question</h2>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
               <h3 className="text-xl font-medium text-gray-800 leading-relaxed">
                  {currentQuestion.replace(/^\d+\.\s*/, '')}
               </h3>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
               <p className="text-xs text-gray-500 flex items-center">
                  <span className="mr-2">ℹ️</span> You have 3 minutes to answer.
               </p>
            </div>
         </div>

         <div className="lg:w-2/3 bg-black rounded-xl overflow-hidden shadow-lg relative">
            <VideoRecorder 
              key={currentQuestionIndex}
              onRecordingComplete={handleRecordingComplete}
              maxDuration={180}
              resetTrigger={resetTrigger}
            />
         </div>
      </main>

      <footer className="bg-white border-t border-gray-200 p-4 shrink-0 z-50">
         <div className="max-w-7xl mx-auto flex justify-end items-center">
            <button
              onClick={handleNext}
              disabled={!recordedBlob || uploading}
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-semibold rounded-lg hover:shadow-lg transition-all disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving Answer...</span>
                </>
              ) : (
                <span>
                  {currentQuestionIndex >= totalQuestions - 1 ? 'Submit Interview' : 'Next Question →'}
                </span>
              )}
            </button>
         </div>
      </footer>

      {(error || backgroundUploadError) && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg z-50">
          <p>{error || backgroundUploadError}</p>
        </div>
      )}
    </div>
  );
}