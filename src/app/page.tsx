"use client";
import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayIcon, PauseIcon, BackwardIcon, ForwardIcon } from '@heroicons/react/24/solid';
import type { ComponentType } from "react";
import type { WaveSurferComponentProps } from "../components/WaveSurferComponent";
import { Slider } from "@/components/ui/slider";

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
  const [zoom, setZoom] = useState(1);

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
    const { a, b } = abMarkers;
    // Only loop if both markers are set and valid
    if (a < b) {
      // Remove any previous looping listeners
      if (loopingHandlerRef.current) {
        loopingHandlerRef.current();
        loopingHandlerRef.current = null;
      }
      // Always jump to A and play
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
      // If markers are not valid, remove looping listeners
      if (loopingHandlerRef.current) {
        loopingHandlerRef.current();
        loopingHandlerRef.current = null;
      }
    }
    // Cleanup on unmount or abMarkers change
    return () => {
      if (loopingHandlerRef.current) {
        loopingHandlerRef.current();
        loopingHandlerRef.current = null;
      }
    };
  }, [abMarkers.a, abMarkers.b, videoRef, duration]);

  // Ensure isPlaying state always matches the actual video state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoRef, audioUrl]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-background p-0 sm:p-2">
      <Card className="w-full max-w-md sm:max-w-2xl p-2 sm:p-4 flex flex-col gap-4 shadow-lg mt-0">
        <h1 className="text-2xl font-bold text-primary mb-2 text-center">Playback & Learn</h1>
        {/* Choose File Button and File Name in one row */}
        <div className="w-full flex flex-row items-center gap-2 mb-2">
          <label htmlFor="file-upload" className="flex-shrink-0">
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
          <div className="text-xs text-muted-foreground truncate w-full">
            {fileName || ''}
          </div>
        </div>
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
              zoom={zoom}
            />
          ) : (
            <div className="w-full h-32 flex items-center justify-center bg-muted rounded text-muted-foreground">
              <span className="text-sm">No Audio loaded</span>
            </div>
          )}
          {/* Main Controls */}
          <div className="flex flex-row gap-2 w-full justify-center sm:mt-0 mt-2">
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
          {/* Zoom slider and reset button below waveform (always visible) */}
          <div className="w-full flex flex-row items-center gap-2 mt-2">
            <span className="text-xs text-gray-500">Zoom</span>
            <Slider
              min={1}
              max={5}
              step={0.1}
              value={[zoom]}
              onValueChange={([val]) => setZoom(val)}
              className="w-32"
            />
            <Button size="sm" variant="outline" onClick={() => setZoom(1)} className="ml-2">Reset Zoom</Button>
          </div>
        </div>
        {/* Controls Section Removed: Repeat */}
      </Card>
    </div>
  );
}
