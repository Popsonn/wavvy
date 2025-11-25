'use client';
import { useEffect, useRef } from 'react';

export default function AudioVisualizer({ stream }: { stream: MediaStream | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 1.8;
      const barGap = 3;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;
        
        const intensity = dataArray[i] / 255;
        const r = Math.floor(102 + (intensity * 16));
        const g = Math.floor(126 - (intensity * 51));
        const b = Math.floor(234 - (intensity * 72));
        
        const gradient = canvasCtx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.6)`);
        
        canvasCtx.fillStyle = gradient;
        
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [3, 3, 0, 0]);
        canvasCtx.fill();
        
        if (barHeight > canvas.height * 0.5) {
          canvasCtx.shadowBlur = 8;
          canvasCtx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
        } else {
          canvasCtx.shadowBlur = 0;
        }
        
        x += barWidth + barGap;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      audioContext.close();
    };
  }, [stream]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={60} 
      className="w-full h-[60px] rounded-lg bg-gray-900/30"
    />
  );
}