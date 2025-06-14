"use client";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import type { MutableRefObject } from "react";
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

interface WaveSurferComponentProps {
  audioUrl: string | null;
  abMarkers: { a: number; b: number };
  setAbMarkers: (markers: { a: number; b: number }) => void;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  draggableMarkers?: boolean;
  scrollable?: boolean;
  onDuration?: (duration: number) => void;
  centerOnAB?: boolean;
  onCenterHandled?: () => void;
}

export type { WaveSurferComponentProps };

export default function WaveSurferComponent({
  audioUrl,
  abMarkers,
  setAbMarkers,
  videoRef,
  draggableMarkers = false,
  scrollable = false,
  onDuration,
  centerOnAB = false,
  onCenterHandled,
}: WaveSurferComponentProps) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const markerARef = useRef<HTMLDivElement>(null);
  const markerBRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!audioUrl || !waveRef.current) return;
    if (wsRef.current) {
      try {
        wsRef.current.destroy();
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) {
          console.error(e);
        }
        // Otherwise, ignore AbortError
      }
      wsRef.current = null;
    }
    wsRef.current = WaveSurfer.create({
      container: waveRef.current,
      waveColor: "#d1d5db",
      progressColor: "#d1d5db",
      height: 96,
      barWidth: 2,
      barGap: 2,
      cursorColor: "#15803d",
      interact: true,
      minPxPerSec: 40,
    });
    // Register regions plugin and set region
    const regionsPlugin = RegionsPlugin.create();
    wsRef.current.registerPlugin(regionsPlugin);
    wsRef.current.load(audioUrl);
    wsRef.current.on("ready", () => {
      setAbMarkers({ a: 0, b: wsRef.current?.getDuration() || 0 });
      if (onDuration && wsRef.current) onDuration(wsRef.current.getDuration());
    });
    // @ts-expect-error: 'seek' is a valid event in wavesurfer.js
    wsRef.current.on("seek", (progress: number) => {
      const duration = wsRef.current?.getDuration() || 0;
      const time = progress * duration;
      if (videoRef.current) videoRef.current.currentTime = time;
    });
    wsRef.current.on('audioprocess', () => {
      setCurrentTime(wsRef.current?.getCurrentTime() || 0);
    });
    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.destroy();
        } catch (e) {
          if (!(e instanceof DOMException && e.name === 'AbortError')) {
            console.error(e);
          }
          // Otherwise, ignore AbortError
        }
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // Update region and marker positions when abMarkers change
  useEffect(() => {
    if (!wsRef.current) return;
    const regionsPlugin = wsRef.current.getActivePlugins().find((p) => (p as { addRegion?: unknown }).addRegion);
    if (!regionsPlugin) return;
    // Remove the old region
    const oldRegion = (regionsPlugin as unknown as { getRegions: () => { id: string; remove: () => void }[] }).getRegions().find((r) => r.id === 'ab-region');
    if (oldRegion) {
      oldRegion.remove();
    }
    // Add the new region
    (regionsPlugin as unknown as { addRegion: (opts: object) => void }).addRegion({
      start: abMarkers.a,
      end: abMarkers.b,
      color: "rgba(34,197,94,0.3)",
      drag: false,
      resize: false,
      id: 'ab-region',
    });
    // Force re-render by updating state (if needed)
    // setCurrentTime(wsRef.current.getCurrentTime() || 0);
  }, [abMarkers.a, abMarkers.b]);

  // Sync video and waveform
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !wsRef.current) return;
    const onTimeUpdate = () => {
      if (!video || !wsRef.current) return;
      const time = video.currentTime;
      wsRef.current.seekTo(time / (wsRef.current.getDuration() || 1));
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [videoRef, audioUrl]);

  // Drag marker logic
  const handleMarkerDrag = (type: "a" | "b") => {
    if (!wsRef.current) return;
    const bounding = waveRef.current?.getBoundingClientRect();
    if (!bounding) return;
    const getX = (ev: TouchEvent | MouseEvent) => ("touches" in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX);
    const duration = wsRef.current.getDuration();
    const onMove = (ev: TouchEvent | MouseEvent) => {
      const x = getX(ev) - bounding.left;
      let percent = x / bounding.width;
      percent = Math.max(0, Math.min(1, percent));
      const time = percent * duration;
      setAbMarkers({ ...abMarkers, [type]: time });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove as EventListener);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove as EventListener);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove as EventListener);
    window.addEventListener("touchend", onUp);
  };

  // Markers snap to the exact time selected by the user (no rounding or peak snapping)
  const getMarkerLeft = (time: number) => {
    if (!wsRef.current) return "0%";
    const duration = wsRef.current.getDuration();
    return `${(time / duration) * 100}%`;
  };

  // Center on A/B logic
  useEffect(() => {
    if (centerOnAB && wsRef.current && waveRef.current) {
      const duration = wsRef.current.getDuration();
      const a = abMarkers.a;
      const b = abMarkers.b;
      const container = waveRef.current;
      // Calculate the scroll position so A and B are at the edges
      const width = container.scrollWidth;
      const left = (a / duration) * width;
      const right = (b / duration) * width;
      // Center between A and B
      const center = (left + right) / 2;
      const scrollTo = Math.max(center - container.clientWidth / 2, 0);
      container.scrollTo({ left: scrollTo, behavior: "smooth" });
      if (onCenterHandled) onCenterHandled();
    }
  }, [centerOnAB, abMarkers, onCenterHandled]);

  // Helper to check if current time is near marker
  const isAtA = Math.abs(currentTime - abMarkers.a) < 0.2;
  const isAtB = Math.abs(currentTime - abMarkers.b) < 0.2;

  // Helper to format seconds as mm:ss
  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div className={`w-full flex flex-col items-center gap-2 ${scrollable ? "overflow-x-auto" : ""}`}
         style={scrollable ? { WebkitOverflowScrolling: "touch", height: "8rem", justifyContent: "center" } : { height: "8rem", justifyContent: "center" }}>
      <div ref={waveRef} className="w-full h-full bg-muted rounded relative flex items-center justify-center">
        {/* Markers */}
        {wsRef.current && (
          <>
            {/* Marker A */}
            <div
              ref={markerARef}
              className="absolute top-0 h-full w-4 flex flex-col items-center justify-center z-10"
              style={{ left: getMarkerLeft(abMarkers.a), transform: "translateX(-50%)" }}
              onMouseDown={draggableMarkers ? () => handleMarkerDrag("a") : undefined}
              onTouchStart={draggableMarkers ? () => handleMarkerDrag("a") : undefined}
            >
              <div className="w-3 h-16 bg-green-600 rounded shadow-lg border-2 border-white flex items-center justify-center">
                <span className="text-xs font-bold text-white select-none">A</span>
              </div>
            </div>
            {/* Marker B */}
            <div
              ref={markerBRef}
              className="absolute top-0 h-full w-4 flex flex-col items-center justify-center z-10"
              style={{ left: getMarkerLeft(abMarkers.b), transform: "translateX(-50%)" }}
              onMouseDown={draggableMarkers ? () => handleMarkerDrag("b") : undefined}
              onTouchStart={draggableMarkers ? () => handleMarkerDrag("b") : undefined}
            >
              <div className="w-3 h-16 bg-green-700 rounded shadow-lg border-2 border-white flex items-center justify-center">
                <span className="text-xs font-bold text-white select-none">B</span>
              </div>
            </div>
          </>
        )}
      </div>
      {/* Marker set buttons */}
      <div className="flex gap-2 w-full justify-between text-xs mt-1 items-center">
        <button
          className={`px-2 py-1 rounded ${isAtA ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"} hover:bg-green-700`}
          onClick={() => setAbMarkers({ ...abMarkers, a: videoRef.current?.currentTime || 0 })}
        >
          Set A
        </button>
        <span className="flex items-center px-2 text-xs font-mono text-gray-600">{formatTime(abMarkers.a)} - {formatTime(abMarkers.b)}</span>
        <button
          className={`px-2 py-1 rounded ${isAtB ? "bg-green-700 text-white" : "bg-gray-200 text-gray-700"} hover:bg-green-700`}
          onClick={() => {
            setAbMarkers({ ...abMarkers, b: videoRef.current?.currentTime || 0 });
          }}
        >
          Set B
        </button>
      </div>
    </div>
  );
} 