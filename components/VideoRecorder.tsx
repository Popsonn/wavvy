'use client';

import { useState, useRef, useEffect } from 'react';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  resetTrigger?: number;
}

export default function VideoRecorder({ 
  onRecordingComplete, 
  maxDuration = 180,
  resetTrigger = 0
}: VideoRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState('');
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (resetTrigger > 0) {
      setRecordedBlob(null);
      setRecordingTime(0);
      setError('');
      setIsRecording(false);
    }
  }, [resetTrigger]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
          setError('Camera/microphone access denied. Please allow access and refresh the page.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found. Please connect a device and refresh.');
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (recordingTime >= maxDuration && isRecording) {
      stopRecording();
    }
  }, [recordingTime, maxDuration, isRecording]);

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
          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-full animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full"></div>
            <span className="font-semibold">Recording</span>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full font-mono text-lg">
            {formatTime(recordingTime)} / {formatTime(maxDuration)}
          </div>
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

      <div className="flex justify-center space-x-4 mt-4">
        {!isRecording && !recordedBlob && (
          <button
            onClick={startRecording}
            disabled={!stream}
            className="px-8 py-4 bg-red-600 text-white text-lg font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <div className="w-4 h-4 bg-white rounded-full"></div>
            <span>Start Recording</span>
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="px-8 py-4 bg-gray-800 text-white text-lg font-semibold rounded-lg hover:bg-gray-900 transition-colors flex items-center space-x-2"
          >
            <div className="w-4 h-4 bg-white"></div>
            <span>Stop Recording</span>
          </button>
        )}
      </div>

      {error && permissionGranted && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm text-center mt-4">
          {error}
        </div>
      )}

      {recordedBlob && !isRecording && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center mt-4">
          <p className="text-green-800 font-medium">
            ✓ Recording complete! Click "Re-record" to try again, or "Next Question" to continue.
          </p>
        </div>
      )}
    </div>
  );
}