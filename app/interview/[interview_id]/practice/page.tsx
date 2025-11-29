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

  useEffect(() => {
    if (!candidateId) {
      router.push(`/interview/${interview_id}/register`);
    }
  }, [candidateId, interview_id, router]);

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
        setError('');
      } catch (err: any) {
        console.error("Preview Camera Error:", err.name, err.message);

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Camera/microphone access denied. Please click the lock icon in your browser address bar to allow access.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect a device.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is in use by another app (like Zoom/Teams) or blocked by macOS System Settings. Please close other apps and check System Settings > Privacy.');
        } else {
          setError(`System Error: ${err.message || 'Failed to access camera/microphone'}`);
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
    router.push(`/interview/${interview_id}/practice?candidate_id=${candidateId}`);
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
        <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-xl shadow-lg p-8 mb-8 text-center">
          <h1 className="text-3xl font-semibold text-white mb-2">{interview?.job_title}</h1>
          <p className="text-white/90 text-lg">Camera & Microphone Check</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-8">
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
              
              {permissionGranted && stream && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-2/3 z-20">
                   <div className="bg-black/40 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                      <p className="text-xs text-center text-white/80 mb-1">Microphone Check</p>
                      <AudioVisualizer stream={stream} />
                   </div>
                </div>
              )}

              {!stream && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800/90">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white">Requesting camera access...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 p-6 z-30">
                  <div className="text-center max-w-md">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h3 className="text-white font-bold text-lg mb-2">Camera Access Failed</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-6">{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {permissionGranted && (
                <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  System Ready
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

          {/* UPDATED: Two-column layout with Practice Mode callout and Interview Rules */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Left Column: Practice Mode Callout */}
            <div className="p-6 bg-emerald-50 rounded-lg border-2 border-emerald-200">
              <h3 className="font-bold text-emerald-900 mb-3 flex items-center">
                <span className="text-xl mr-2">👉</span>
                First Step: Practice Mode
              </h3>
              <p className="text-emerald-800 text-sm leading-relaxed mb-3">
                You will answer <strong>one ungraded practice question</strong> to get comfortable with the recording controls before the real interview begins.
              </p>
              <div className="p-3 bg-emerald-100/50 rounded text-xs text-emerald-700">
                💡 Use this to check your lighting, audio levels, and camera angle.
              </div>
            </div>
            
            {/* Right Column: Interview Rules */}
            <div className="p-6 bg-amber-50 rounded-lg border border-amber-100">
              <h3 className="font-bold text-amber-900 mb-3 flex items-center">
                <span className="mr-2">⚠️</span>
                Real Interview Rules
              </h3>
              <ul className="space-y-2 text-amber-800 text-sm">
                <li>• <strong>{questionCount} questions</strong> total</li>
                <li>• <strong>3 minutes</strong> max per answer</li>
                <li>• <strong>No re-recording</strong> once started</li>
                <li>• <strong>No back button</strong> - stay in flow</li>
              </ul>
            </div>
          </div>

          {/* UPDATED: Button with clear messaging */}
          <div className="text-center">
            <button
              onClick={handleContinue}
              disabled={!permissionGranted}
              className="w-full md:w-auto px-12 py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white text-lg font-bold rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {permissionGranted ? 'Continue to Practice Mode →' : 'Waiting for camera access...'}
            </button>
            
            {permissionGranted && (
              <p className="mt-4 text-sm text-gray-500">
                You won't be graded yet. This is just a system check.
              </p>
            )}
          </div>
        </div>

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