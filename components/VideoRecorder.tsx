'use client';

import { useState, useRef, useEffect } from 'react';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  autoStartRecording?: boolean;
}

export default function VideoRecorder({ 
  onRecordingComplete, 
  maxDuration = 180,
  autoStartRecording = false
}: VideoRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showFinishButton, setShowFinishButton] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const FINISH_BUTTON_DELAY = 10;
  const MIN_RECORDING_TIME = 5;

  // Setup camera on mount
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
          setError('Camera/microphone access denied. Please refresh and allow access.');
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Set video stream
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Auto-start recording when triggered
  useEffect(() => {
    if (autoStartRecording && stream && !isRecording && !recordedBlob) {
      startRecording();
    }
  }, [autoStartRecording, stream]);

  // Auto-stop at max duration
  useEffect(() => {
    if (recordingTime >= maxDuration && isRecording) {
      stopRecording();
    }
  }, [recordingTime, maxDuration, isRecording]);

  // Show finish button after delay
  useEffect(() => {
    if (isRecording) {
      const timer = setTimeout(() => {
        setShowFinishButton(true);
      }, FINISH_BUTTON_DELAY * 1000);
      return () => clearTimeout(timer);
    } else {
      setShowFinishButton(false);
    }
  }, [isRecording]);

  const startRecording = () => {
    if (!stream) {
      setError('Camera not ready. Please wait or refresh the page.');
      return;
    }

    try {
      chunksRef.current = [];
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setRecordedBlob(blob);
        onRecordingComplete(blob);
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      setError('');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Check minimum recording time
      if (recordingTime < MIN_RECORDING_TIME) {
        setError(`Please record for at least ${MIN_RECORDING_TIME} seconds.`);
        return;
      }

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timeRemaining = Math.max(0, maxDuration - recordingTime);
  const isWarning = timeRemaining <= 30;

  if (error && !permissionGranted) {
    return (
      <div className="w-full bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
        <div className="text-red-600 text-5xl mb-4">📹</div>
        <h3 className="text-xl font-semibold text-red-900 mb-2">Camera Access Required</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="relative w-full flex-1 bg-gray-900 rounded-lg overflow-hidden min-h-[300px]">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover" 
        />
        
        {isRecording && (
          <>
            {/* Recording Indicator */}
            <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full animate-pulse z-10 shadow-lg">
              <div className="w-3 h-3 bg-white rounded-full"></div>
              <span className="font-semibold text-sm">REC</span>
            </div>
            
            {/* Time Remaining */}
            <div className={`absolute top-4 right-4 px-4 py-2 rounded-full font-mono text-lg font-bold z-10 shadow-lg transition-all ${
              isWarning 
                ? 'bg-red-600 text-white animate-pulse scale-110' 
                : 'bg-black bg-opacity-70 text-white'
            }`}>
              {formatTime(timeRemaining)}
            </div>

            {/* Recording Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800 bg-opacity-50">
              <div 
                className="h-full bg-red-600 transition-all duration-1000"
                style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
              ></div>
            </div>
          </>
        )}

        {!stream && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-90">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-white">Initializing camera...</p>
            </div>
          </div>
        )}
      </div>

      {/* Control Area */}
      <div className="flex justify-center mt-4 h-16 items-center">
        {/* Finish Answer Button (after delay) */}
        {isRecording && showFinishButton && (
          <button
            onClick={stopRecording}
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-lg font-semibold rounded-lg hover:shadow-xl transition-all flex items-center space-x-2 shadow-lg transform hover:scale-105 active:scale-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Finish Answer</span>
          </button>
        )}
        
        {/* Countdown to button availability */}
        {isRecording && !showFinishButton && (
          <div className="text-gray-500 text-sm italic flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
            <span>
              Finish button available in {Math.max(0, FINISH_BUTTON_DELAY - recordingTime)}s...
            </span>
          </div>
        )}
        
        {/* Waiting for auto-start */}
        {!isRecording && !recordedBlob && stream && (
          <div className="text-gray-500 italic text-sm flex items-center space-x-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <span>Recording will begin automatically...</span>
          </div>
        )}
        
        {/* Recording complete */}
        {recordedBlob && !isRecording && (
          <div className="flex items-center space-x-2 text-green-600 font-medium">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            <span>Answer Recorded Successfully!</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && permissionGranted && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center mt-2">
          {error}
        </div>
      )}
    </div>
  );
}