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

interface FailedUpload {
  blob: Blob;
  questionIndex: number;
  attempts: number;
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

  const [countdownSeconds, setCountdownSeconds] = useState(30);
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [canRecord, setCanRecord] = useState(false);
  const [autoAdvancing, setAutoAdvancing] = useState(false);
  const [totalElapsedTime, setTotalElapsedTime] = useState(0);

  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [retryingUploads, setRetryingUploads] = useState(false);

  const advanceRef = useRef(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const failedUploadsRef = useRef<FailedUpload[]>([]);

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

  // Countdown timer that resets on each new question
  useEffect(() => {
    // Calculate dynamic reading time based on question length
    if (interview && candidate) {
      const questionOrder = candidate.question_order || Array.from({ length: interview.questions.length }, (_, i) => i);
      const currentQuestion = interview.questions[questionOrder[currentQuestionIndex]];
      const words = currentQuestion.split(' ').length;
      const readingTime = Math.ceil(words / 3) + 5; // 3 words/sec + 5s buffer
      setCountdownSeconds(readingTime);
    } else {
      setCountdownSeconds(30); // Fallback to 30s if data not loaded
    }

    setIsCountingDown(true);
    setCanRecord(false);
    setRecordedBlob(null);
    setAutoAdvancing(false);
    setUploading(false);
    advanceRef.current = false;

    countdownIntervalRef.current = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          setIsCountingDown(false);
          setCanRecord(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [currentQuestionIndex, interview, candidate]);

  // Fetch interview and candidate data
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
        const message = err instanceof Error ? err.message : 'Failed to load data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    if (candidateId) fetchData();
  }, [interview_id, candidateId]);

  // Auto-advance when recording completes
  useEffect(() => {
    if (recordedBlob && !uploading && !autoAdvancing && !advanceRef.current) {
      advanceRef.current = true;
      handleAutoAdvance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordedBlob]);

  // Trigger retry when failed uploads exist
  useEffect(() => {
    if (failedUploads.length > 0 && !retryingUploads) {
      retryFailedUploads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedUploads.length]);

  // Sync failedUploads state with ref (critical for while loop)
  useEffect(() => {
    failedUploadsRef.current = failedUploads;
  }, [failedUploads]);

  const handleManualStart = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setIsCountingDown(false);
    setCanRecord(true);
  };

  const handleRecordingComplete = (blob: Blob) => {
    setRecordedBlob(blob);
    setError('');
    setBackgroundUploadError('');
  };

  const uploadVideo = async (blob: Blob, originalQuestionIndex: number): Promise<boolean> => {
    try {
      const filename = `interviews/${interview_id}/${candidateId}/question-${originalQuestionIndex}.webm`;
      const { upload } = await import('@vercel/blob/client');
      
      await upload(filename, blob, {
        access: 'public',
        handleUploadUrl: `/api/interview/${interview_id}/upload?candidate_id=${candidateId}&question_index=${originalQuestionIndex}`,
      });

      setUploadedCount(prev => prev + 1);
      return true;
    } catch (err) {
      console.error('Upload error:', err);
      return false;
    }
  };

  const retryFailedUploads = async () => {
    if (retryingUploads || failedUploads.length === 0) return;
    
    setRetryingUploads(true);
    const uploadsToRetry = [...failedUploads];
    const stillFailed: FailedUpload[] = [];

    for (const failed of uploadsToRetry) {
      if (failed.attempts >= 3) {
        stillFailed.push(failed);
        
        // Log only after exhausting all retries
        fetch('/api/log-upload-failure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            interview_id,
            candidate_id: candidateId,
            question_index: failed.questionIndex,
            error: `Upload failed after ${failed.attempts} attempts`,
            timestamp: new Date().toISOString()
          })
        }).catch(err => console.error('Failed to log:', err));
        
        continue;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, failed.attempts - 1), 5000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const success = await uploadVideo(failed.blob, failed.questionIndex);
      
      if (!success) {
        stillFailed.push({
          ...failed,
          attempts: failed.attempts + 1
        });
      }
    }

    setFailedUploads(stillFailed);
    setRetryingUploads(false);

    if (stillFailed.length > 0) {
      setBackgroundUploadError(
        `${stillFailed.length} upload(s) retrying in background...`
      );
    } else {
      setBackgroundUploadError('');
    }
  };

  const handleAutoAdvance = async () => {
    if (!recordedBlob || !candidateId || !interview || !candidate) return;

    const currentBlob = recordedBlob;
    const questionOrder = candidate.question_order || [];
    const originalQuestionIndex = questionOrder[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex >= questionOrder.length - 1;

    if (isLastQuestion) {
      // LAST QUESTION: Upload with timeout, then complete
      setAutoAdvancing(true);
      setUploading(true);
      setError('');

      // Upload with 5-second timeout
      const uploadPromise = uploadVideo(currentBlob, originalQuestionIndex);
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.warn('⏱️ Last question upload timeout (5s)');
          resolve(false);
        }, 5000);
      });
      
      const uploadSuccess = await Promise.race([uploadPromise, timeoutPromise]);
      
      if (!uploadSuccess) {
        console.error('❌ Last question upload failed or timed out');
        
        // Add to retry queue (logging handled by retryFailedUploads)
        setFailedUploads(prev => [...prev, {
          blob: currentBlob,
          questionIndex: originalQuestionIndex,
          attempts: 1
        }]);
      }
      
      // Wait for stragglers (max 10s)
      if (failedUploadsRef.current.length > 0) {
        setError(`Finalizing ${failedUploadsRef.current.length} upload(s)...`);
        
        const maxWait = 10000;
        const startTime = Date.now();
        
        while (failedUploadsRef.current.length > 0 && (Date.now() - startTime) < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Log warning if uploads still pending
        if (failedUploadsRef.current.length > 0) {
          console.warn(`⚠️ ${failedUploadsRef.current.length} upload(s) still retrying`);
        }
      } else {
        // No pending uploads - quick completion
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Complete interview - backend will validate completeness
      router.push(`/interview/${interview_id}/complete?candidate_id=${candidateId}`);
      
    } else {
      // NON-FINAL QUESTIONS: Advance immediately, upload in background
      setAutoAdvancing(true);
      
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setRecordedBlob(null);
        setAutoAdvancing(false);
        setUploading(false);
      }, 800);

      // Upload in background (logging handled by retryFailedUploads)
      uploadVideo(currentBlob, originalQuestionIndex).then(success => {
        if (success) {
          setUploadedCount(prev => prev + 1);
        } else {
          setFailedUploads(prev => [...prev, {
            blob: currentBlob,
            questionIndex: originalQuestionIndex,
            attempts: 1
          }]);
          setBackgroundUploadError(
            `Question ${currentQuestionIndex + 1} uploading in background...`
          );
        }
      }).catch(err => {
        console.error('Background upload error:', err);
        setFailedUploads(prev => [...prev, {
          blob: currentBlob,
          questionIndex: originalQuestionIndex,
          attempts: 1
        }]);
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
          <a href={`/interview/${interview_id}`} className="inline-block px-6 py-3 bg-gray-600 text-white rounded-lg">Exit</a>
        </div>
      </div>
    );
  }

  if (!interview || !candidate) return null;

  const questionOrder = candidate.question_order || Array.from({ length: interview.questions.length }, (_, i) => i);
  const currentQuestion = interview.questions[questionOrder[currentQuestionIndex]];
  const totalQuestions = questionOrder.length;
  const progress = ((uploadedCount) / totalQuestions) * 100;
  const isLastQuestion = currentQuestionIndex >= questionOrder.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-4 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Subtle background upload notification */}
        {backgroundUploadError && (
          <div className="bg-yellow-50 border-l-2 border-yellow-400 p-2 mb-3 rounded text-xs">
            <div className="flex items-center justify-between">
              <span className="text-yellow-700 flex items-center">
                <span className="mr-2">⚠️</span>
                {backgroundUploadError}
              </span>
              {failedUploads.length > 0 && (
                <span className="text-yellow-600 font-semibold ml-2">
                  {failedUploads.length} retrying
                </span>
              )}
            </div>
          </div>
        )}

        {/* Compact Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{interview.job_title}</h1>
              <div className="flex items-center gap-2 text-gray-500 text-sm font-mono mt-1">
                <span>⏱️ {formatTotalTime(totalElapsedTime)}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 uppercase tracking-wide">Progress</p>
              <p className="text-xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
                {currentQuestionIndex + 1} / {totalQuestions}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 shadow-inner">
            <div 
              className="bg-gradient-to-r from-[#667eea] to-[#764ba2] h-2 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Main Interview Area */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-4">
          <div className="flex flex-col lg:flex-row gap-6 min-h-[450px]">
            
            {/* Question Display */}
            <div className="lg:w-2/5 flex flex-col">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Current Question:</h2>
              <div className="flex-1 p-5 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-100 flex items-start">
                <p className="text-gray-800 text-xl leading-relaxed font-medium">
                  {currentQuestion.replace(/^\d+\.\s*/, '')}
                </p>
              </div>
            </div>

            {/* Video Recorder Area */}
            <div className="lg:w-3/5 flex flex-col relative">
              
              {/* Countdown Overlay */}
              {isCountingDown && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 bg-opacity-98 rounded-lg border-2 border-blue-200 shadow-inner">
                  <div className="text-center p-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl shadow-md">
                      🎥
                    </div>
                    <h3 className="text-blue-900 text-xl font-semibold mb-2">Prepare Your Answer</h3>
                    <div className="text-7xl font-bold text-blue-600 font-mono my-4 drop-shadow-sm">
                      {countdownSeconds}
                    </div>
                    <p className="text-blue-700 text-sm mb-4">
                      Recording will auto-start when timer reaches 0
                    </p>
                    <button
                      onClick={handleManualStart}
                      className="mt-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:shadow-xl transition-all transform hover:scale-105 active:scale-100 shadow-md"
                    >
                      Start Recording Now →
                    </button>
                    <p className="text-xs text-blue-600 mt-3 italic">
                      Or wait for auto-start
                    </p>
                  </div>
                </div>
              )}

              {/* Auto-Advancing Overlay */}
              {autoAdvancing && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 bg-opacity-98 rounded-lg border-2 border-green-200 shadow-inner">
                  <div className="text-center p-8">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-green-500 border-t-transparent mx-auto mb-6"></div>
                    <h3 className="text-green-900 text-2xl font-bold mb-2">Answer Recorded!</h3>
                    <p className="text-green-700 text-lg">
                      {isLastQuestion ? 'Finalizing interview...' : 'Moving to next question...'}
                    </p>
                    <p className="text-sm text-green-600 mt-2">✓ Uploading in background</p>
                  </div>
                </div>
              )}

              <VideoRecorder 
                key={currentQuestionIndex}
                onRecordingComplete={handleRecordingComplete}
                maxDuration={180}
                autoStartRecording={canRecord}
              />
            </div>
          </div>
        </div>

        {/* Exit Button */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => {
              if (window.confirm('⚠️ Are you sure? Your progress will be lost and you cannot resume this interview.')) {
                router.push(`/interview/${interview_id}`);
              }
            }}
            className="text-gray-400 hover:text-red-600 font-medium text-sm transition-colors px-2"
          >
            ← Exit Interview
          </button>

          {/* Show pending uploads warning */}
          {failedUploads.length > 0 && (
            <div className="text-xs text-yellow-600 font-medium">
              ⚠️ {failedUploads.length} upload(s) pending
            </div>
          )}
        </div>

        {/* Error Display (only for critical errors during interview) */}
        {error && interview && (
          <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 rounded-lg text-sm shadow-sm">
            <p className="font-semibold mb-1">⚠️ Upload Status</p>
            <p className="whitespace-pre-line">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}