'use client';

import { useState, useRef, useEffect } from 'react';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number; // default 180 seconds (3 mins)
  resetTrigger?: number;
}

export default function VideoRecorder({ 
  onRecordingComplete, 
  maxDuration = 180,
  resetTrigger = 0
}: VideoRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset logic (Triggered when parent moves to next question)
  useEffect(() => {
    if (resetTrigger > 0) {
      setRecordedBlob(null);
      setRecordingTime(0);
      setIsRecording(false);
      setCountdown(null);
      // Re-initialize stream if lost
      if (!stream) initializeStream(); 
    }
  }, [resetTrigger]);

  const initializeStream = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError('');
    } catch (err: any) {
      console.error("Camera Setup Error:", err.name, err.message);

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
  };

  useEffect(() => {
    initializeStream();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Ensure video element gets stream updates
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const handleStartClick = () => {
    if (!stream) return;
    setCountdown(3);
    
    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(interval);
        setCountdown(null);
        startRecordingActual();
      }
    }, 1000);
  };

  const startRecordingActual = () => {
    if (!stream) return;
    
    chunksRef.current = [];
    
    // SAFARI/IPHONE FIX: Check supported types
    const mimeTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
    ];
    const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';

    if (!mimeType) {
        setError('Browser recording not supported.');
        return;
    }

    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      onRecordingComplete(blob);
    };

    recorder.start(1000); 
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= maxDuration) {
            stopRecording();
            return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl group">
      {/* Video Feed */}
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />

      {/* ERROR OVERLAY - Enhanced with Better Messages */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 z-50 p-4">
           <div className="text-white text-center max-w-md">
             <div className="text-5xl mb-4">⚠️</div>
             <h3 className="text-xl font-bold mb-2">Camera Issue</h3>
             <p className="text-gray-300 mb-6 text-sm leading-relaxed">{error}</p>
             <button 
               onClick={() => window.location.reload()} 
               className="px-6 py-3 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-medium"
             >
               Reload Page
             </button>
           </div>
        </div>
      )}

      {/* COUNTDOWN OVERLAY */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-40">
          <span className="text-9xl font-bold text-white animate-bounce">{countdown}</span>
        </div>
      )}

      {/* STATUS OVERLAYS */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-30">
        {isRecording && (
            <div className="bg-red-500/90 text-white px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm font-bold">REC</span>
            </div>
        )}
        <div className="bg-black/60 text-white px-3 py-1 rounded-full font-mono text-sm border border-white/20">
            {formatTime(recordingTime)} / {formatTime(maxDuration)}
        </div>
      </div>

      {/* COMPLETED STATE OVERLAY */}
      {recordedBlob && !isRecording && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-40 text-white">
          <div className="bg-green-500 rounded-full p-4 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold">Answer Recorded</h3>
          <p className="text-gray-300 mb-6">Recording saved. Click "Next" to continue.</p>
        </div>
      )}

      {/* CONTROLS */}
      {!isRecording && !recordedBlob && !countdown && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50">
          <button onClick={handleStartClick} disabled={!stream} 
            className="group/btn flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
             <div className="w-4 h-4 bg-white rounded-full group-hover/btn:animate-pulse"></div>
             Start Answer
          </button>
        </div>
      )}
      
      {/* Stop Button - Subtle Bottom-Right Corner */}
      {isRecording && (
        <button onClick={stopRecording} 
          className="absolute bottom-4 right-4 flex items-center gap-2 bg-gray-800/80 hover:bg-gray-900 backdrop-blur-sm border border-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all hover:scale-105 z-50">
           <div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div>
           Stop
        </button>
      )}
    </div>
  );
}