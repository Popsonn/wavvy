'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, use } from 'react';
import AudioVisualizer from '@/components/AudioVisualizer';

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
        if (!response.ok) throw new Error('Interview not found');
        const data = await response.json();
        setInterview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load interview');
      } finally {
        setLoading(false);
      }
    }
    if (candidateId) fetchInterview();
  }, [interview_id, candidateId]);

  // Setup camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true
        });

        setStream(mediaStream);
        setPermissionGranted(true);
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
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
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleContinue = () => {
    if (!permissionGranted) {
      setError('Please allow camera and microphone access before continuing.');
      return;
    }
    if (stream) stream.getTracks().forEach(track => track.stop());
    router.push(`/interview/${interview_id}/record?candidate_id=${candidateId}`);
  };

  // Loading State
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

  // Error State (no interview loaded)
  if (error && !interview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white rounded-lg hover:shadow-lg transition-all font-medium"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const questionCount = interview?.questions.length || 5;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl shadow-lg p-8 mb-8 text-center">
          <h1 className="text-3xl font-semibold text-white mb-2">{interview?.job_title}</h1>
          <p className="text-white/90 text-lg">Camera & Microphone Check</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
          {/* Camera Preview Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Camera Preview</h2>
            
            <div className="relative w-full bg-black rounded-lg overflow-hidden aspect-video shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              
              {/* AudioVisualizer Overlay - Set 2's Innovation */}
              {permissionGranted && stream && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-2/3 z-20">
                   <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                      <p className="text-xs text-center text-white/80 mb-1">Microphone Check</p>
                      <AudioVisualizer stream={stream} />
                   </div>
                </div>
              )}

              {/* Loading State */}
              {!stream && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white">Requesting camera access...</p>
                  </div>
                </div>
              )}

              {/* Error Overlay - Set 1's Error Handling */}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-90">
                  <div className="text-center px-6">
                    <div className="text-white text-5xl mb-4">📹</div>
                    <p className="text-white font-medium mb-4">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-white text-red-900 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium"
                    >
                      Refresh Page
                    </button>
                  </div>
                </div>
              )}

              {/* System Ready Badge - Set 2's Confidence */}
              {permissionGranted && (
                <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  System Ready
                </div>
              )}
            </div>

            {/* Success Confirmation - Set 1's Reassurance */}
            {permissionGranted && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
                <p className="text-green-800 text-sm font-medium">
                  ✓ Great! Your camera and microphone are working properly.
                </p>
              </div>
            )}
          </div>

          {/* Info Grid - Set 2's Clean Layout */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Quick Overview - Set 2's Approach */}
            <div className="p-6 bg-blue-50 rounded-lg border border-blue-100">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Quick Overview
              </h3>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li>• <strong>{questionCount} questions</strong> total</li>
                <li>• <strong>3 minutes</strong> max per answer</li>
              </ul>
            </div>
            
            {/* Important Guidelines - Balanced Visual Weight */}
            <div className="p-6 bg-amber-50 rounded-lg border border-amber-100">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center">
                <span className="mr-2">⚠️</span>
                Important Guidelines
              </h3>
              <p className="text-amber-900 mb-3 text-sm font-medium">
                Please Note:
              </p>
              <ul className="space-y-2 text-amber-800 text-sm">
                <li>• <strong>Read each question carefully</strong> before recording</li>
                <li>• <strong>No Re-recording:</strong> First take only</li>
                <li>• <strong>No Back Button:</strong> Stay in the flow</li>
              </ul>
            </div>
          </div>

          {/* Continue Button - Set 2's Personal CTA */}
          <div className="text-center">
            <button
              onClick={handleContinue}
              disabled={!permissionGranted}
              className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {permissionGranted ? 'I am Ready - Start Interview' : 'Waiting for camera access...'}
            </button>
          </div>
        </div>

        {/* Back Link - Set 1's Navigation Safety */}
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