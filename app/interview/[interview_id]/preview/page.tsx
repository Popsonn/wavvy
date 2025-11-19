'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, use } from 'react';

interface InterviewData {
  job_title: string;
  questions: string[];
}

export default function PreviewPage({
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
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Redirect if no candidate_id
  useEffect(() => {
    if (!candidateId) {
      router.push(`/interview/${interview_id}/register`);
    }
  }, [candidateId, interview_id, router]);

  // Fetch interview data
  useEffect(() => {
    async function fetchInterview() {
      try {
        const response = await fetch(`/api/interview/${interview_id}`);
        
        if (!response.ok) {
          throw new Error('Interview not found');
        }
        
        const data = await response.json();
        setInterview(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load interview';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    
    if (candidateId) {
      fetchInterview();
    }
  }, [interview_id, candidateId]);

  // Setup camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: true
        });

        setStream(mediaStream);
        setPermissionGranted(true);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setError('Camera/microphone access denied. Please allow access to continue.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect a device.');
        } else {
          setError('Failed to access camera/microphone. Please check your device settings.');
        }
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleContinue = () => {
    if (!permissionGranted) {
      setError('Please allow camera and microphone access before continuing.');
      return;
    }
    
    // Stop the stream before navigating
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    router.push(`/interview/${interview_id}/record?candidate_id=${candidateId}`);
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

  const questionCount = interview?.questions.length || 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl shadow-lg p-8 mb-8 text-center">
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">
            {interview?.job_title}
          </h1>
          <p className="text-white/90 text-lg">
            Camera & Microphone Check
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          {/* Camera Preview Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <svg className="w-6 h-6 text-[#667eea] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Camera Preview
            </h2>
            
            <div className="relative w-full bg-gray-900 rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
              
              {!stream && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white">Requesting camera access...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-90">
                  <div className="text-center px-6">
                    <div className="text-white text-5xl mb-4">📹</div>
                    <p className="text-white font-medium">{error}</p>
                  </div>
                </div>
              )}

              {permissionGranted && (
                <div className="absolute top-4 left-4 flex items-center space-x-2 bg-green-600 text-white px-3 py-1.5 rounded-full text-sm">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  <span className="font-medium">Camera Active</span>
                </div>
              )}
            </div>

            {permissionGranted && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-800 text-sm font-medium">
                  ✓ Great! Your camera and microphone are working properly.
                </p>
              </div>
            )}
          </div>

          {/* Quick Info */}
          <div className="mb-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Quick Overview
            </h3>
            
            <div className="space-y-2 text-gray-700">
              <p className="flex items-start">
                <span className="text-blue-600 mr-2 font-bold text-lg">•</span>
                <span><strong className="text-gray-900">{questionCount} questions</strong> total</span>
              </p>
              <p className="flex items-start">
                <span className="text-blue-600 mr-2 font-bold text-lg">•</span>
                <span><strong className="text-gray-900">3 minutes maximum</strong> per question</span>
              </p>
            </div>
          </div>

          {/* Recording Guidelines - MERGED SECTION */}
          <div className="mb-8 p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg border-2 border-amber-300">
            <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center">
              <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recording Guidelines
            </h3>
            
            <div className="space-y-4">
              {/* Critical Rules */}
              <div>
                <p className="font-semibold text-amber-900 mb-2 flex items-center">
                  <span className="mr-2">⚠️</span>
                  Critical:
                </p>
                <div className="space-y-2 text-amber-900 text-sm">
                  <p className="flex items-start">
                    <span className="text-amber-600 mr-2 font-bold">•</span>
                    <span><strong>One recording per question</strong> - there are no retakes</span>
                  </p>
                  <p className="flex items-start">
                    <span className="text-amber-600 mr-2 font-bold">•</span>
                    <span>Recording will <strong>begin automatically when the countdown reaches zero</strong>, but you can start earlier by clicking the record button if you're ready</span>
                  </p>
                  <p className="flex items-start">
                    <span className="text-amber-600 mr-2 font-bold">•</span>
                    <span><strong>Read each question carefully</strong> before you begin recording</span>
                  </p>
                </div>
              </div>

              {/* Quick Tips */}
              <div className="pt-3 border-t border-amber-300">
                <p className="font-semibold text-amber-900 mb-2 flex items-center">
                  <span className="mr-2">💡</span>
                  Quick Tips:
                </p>
                <div className="space-y-2 text-amber-900 text-sm">
                  <p className="flex items-start">
                    <span className="text-amber-600 mr-2">✓</span>
                    <span>Speak clearly and look directly at the camera</span>
                  </p>
                  <p className="flex items-start">
                    <span className="text-amber-600 mr-2">✓</span>
                    <span>Use specific examples from your experience when relevant</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg">
              <p className="font-semibold mb-1">Camera/Microphone Issue</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              >
                Refresh Page
              </button>
            </div>
          )}

          {/* Continue Button */}
          <div className="text-center">
            <button
              onClick={handleContinue}
              disabled={!permissionGranted}
              className="px-10 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-semibold rounded-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-100 shadow-lg disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:transform-none"
            >
              {permissionGranted ? 'Continue to Interview →' : 'Waiting for camera access...'}
            </button>
            
            {permissionGranted && (
              <p className="mt-4 text-sm text-gray-600">
                Click continue when you're ready to start the interview
              </p>
            )}
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <a
            href={`/interview/${interview_id}/register`}
            className="text-sm text-gray-600 hover:text-[#667eea] font-medium transition-colors"
          >
            ← Back to registration
          </a>
        </div>
      </div>
    </div>
  );
}