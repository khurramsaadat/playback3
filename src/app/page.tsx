"use client";
import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayIcon, PauseIcon, BackwardIcon, ForwardIcon } from '@heroicons/react/24/solid';
import type { ComponentType } from "react";
import type { WaveSurferComponentProps } from "../components/WaveSurferComponent";

const WaveSurferComponent = dynamic(() =>
  import("../components/WaveSurferComponent") as Promise<{ default: ComponentType<WaveSurferComponentProps> }>
, { ssr: false });

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [abMarkers, setAbMarkers] = useState<{ a: number; b: number }>({ a: 0, b: 0 });
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [centerOnAB, setCenterOnAB] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Store looping handler refs to allow cleanup
  const loopingHandlerRef = useRef<(() => void) | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setAudioUrl(url); // For now, use the same URL for both video and audio
      setFileName(file.name);
    }
  };

  // Track play/pause state
  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    const { a, b } = abMarkers;
    // Remove any previous looping listeners
    if (loopingHandlerRef.current) {
      loopingHandlerRef.current();
      loopingHandlerRef.current = null;
    }
    if (!video.paused) {
      // Pause and cleanup
      video.pause();
      return;
    }
    // Play and set up looping if A/B markers are set
    if (a < b && (a > 0 || b < duration)) {
      video.currentTime = a;
      video.play();
      const onTimeUpdate = () => {
        if (video.currentTime >= b) {
          video.currentTime = a;
          video.play();
        }
      };
      const onPause = () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('pause', onPause);
      };
      video.addEventListener('timeupdate', onTimeUpdate);
      video.addEventListener('pause', onPause);
      loopingHandlerRef.current = () => {
        video.removeEventListener('timeupdate', onTimeUpdate);
        video.removeEventListener('pause', onPause);
      };
    } else {
      video.currentTime = 0;
      video.play();
    }
  };

  // Helper to format seconds as mm:ss
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Listen for play/pause events to update isPlaying
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    // Also listen for ended event to set isPlaying false
    video.addEventListener('ended', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onPause);
    };
  }, [videoRef, audioUrl]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-background p-0 sm:p-2">
      <Card className="w-full max-w-md sm:max-w-2xl p-2 sm:p-4 flex flex-col gap-4 shadow-lg mt-0">
        <h1 className="text-2xl font-bold text-primary mb-2 text-center">Playback & Learn</h1>
        {/* Choose File Button */}
        <label htmlFor="file-upload" className="w-full flex justify-center mb-1">
          <Button asChild size="sm" className="w-auto px-3 py-1.5 text-sm">
            <span>Choose File</span>
          </Button>
          <input
            id="file-upload"
            type="file"
            accept="video/*,audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        {fileName && (
          <div className="text-xs text-muted-foreground truncate w-full text-center mb-2">
            {fileName}
          </div>
        )}
        {/* Video Section */}
        <div className="w-full flex items-center justify-center bg-muted rounded-lg aspect-video overflow-hidden max-h-48 sm:max-h-56">
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground">
              <span className="text-lg">No video loaded</span>
              <span className="text-xs">Upload a video or audio file</span>
            </div>
          )}
        </div>
        {/* Waveform Section */}
        <div className="w-full min-h-32 flex flex-col items-center justify-center gap-2">
          {/* Zoom Slider Removed */}
          {audioUrl ? (
            <WaveSurferComponent
              audioUrl={audioUrl}
              abMarkers={abMarkers}
              setAbMarkers={(markers: { a: number; b: number }) => setAbMarkers(markers)}
              videoRef={videoRef}
              draggableMarkers
              scrollable
              onDuration={(d: number) => setDuration(d)}
              centerOnAB={centerOnAB}
              onCenterHandled={() => setCenterOnAB(false)}
            />
          ) : (
            <div className="w-full h-32 flex items-center justify-center bg-muted rounded text-muted-foreground">
              <span className="text-sm">No Audio loaded</span>
            </div>
          )}
          {/* Playback Controls */}
          <div className="flex flex-col sm:flex-row gap-2 justify-center items-center mt-2 w-full">
            <div className="flex flex-row gap-2 w-full justify-center">
              {/* Marker Controls - Set A and Set B */}
              <button
                className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                onClick={() => setAbMarkers({ ...abMarkers, a: videoRef.current?.currentTime || 0 })}
              >
                Set A
              </button>
              <span className="flex items-center px-2 text-xs font-mono text-gray-600">{formatTime(abMarkers.a)} - {formatTime(abMarkers.b)}</span>
              <button
                className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                onClick={() => {
                  setAbMarkers({ ...abMarkers, b: videoRef.current?.currentTime || 0 });
                  setCenterOnAB(true); // Center A/B
                }}
              >
                Set B
              </button>
            </div>
            <div className="flex flex-row gap-2 w-full justify-center sm:mt-0 mt-2">
              {/* Main Controls */}
              <Button size="sm" variant="outline" onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }} disabled={!audioUrl} aria-label="Go to Start">
                <span className="tooltip" data-tooltip="Start">
                  <BackwardIcon className="w-5 h-5" />
                </span>
              </Button>
              <Button size="sm" variant="outline" onClick={handlePlayPause} disabled={!audioUrl} aria-label={isPlaying ? "Pause" : "Play"}>
                <span className="tooltip" data-tooltip={isPlaying ? "Pause" : "Play"}>
                  {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                </span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => { if (videoRef.current && duration) videoRef.current.currentTime = duration; }} disabled={!audioUrl} aria-label="Go to End">
                <span className="tooltip" data-tooltip="End">
                  <ForwardIcon className="w-5 h-5" />
                </span>
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setAbMarkers({ a: 0, b: duration })} disabled={!audioUrl} aria-label="Clear A/B Markers">
                Clear A/B
              </Button>
            </div>
          </div>
        </div>
        {/* Controls Section Removed: Repeat */}
      </Card>
    </div>
  );
}
