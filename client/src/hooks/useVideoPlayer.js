import { useRef, useState, useCallback, useEffect } from 'react';

export const SPEEDS = [8, 6, 4, 2, 1, 0.75, 0.5, 0.25];

export function useVideoPlayer() {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(SPEEDS.indexOf(1));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(null);
  const [fpsOverride, setFpsOverride] = useState('');

  const speed = SPEEDS[speedIndex];
  const fpsValue = Number(fpsOverride);
  const fpsOverrideIsValid = fpsOverride === '' || (Number.isFinite(fpsValue) && fpsValue >= 1 && fpsValue <= 240);
  const fpsError = fpsOverride !== '' && !fpsOverrideIsValid ? 'FPS must be a number from 1 to 240.' : '';
  const effectiveFps = fpsOverrideIsValid && fpsOverride !== '' ? fpsValue : fps || null;

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const play = useCallback(() => {
    videoRef.current?.play();
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
    setPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) pause();
    else play();
  }, [playing, play, pause]);

  const seek = useCallback((time) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(time, videoRef.current.duration || time));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const rewind = useCallback(
    (seconds = 10) => {
      if (!videoRef.current) return;
      seek(videoRef.current.currentTime - seconds);
    },
    [seek]
  );

  const speedUp = useCallback(() => setSpeedIndex((i) => Math.max(0, i - 1)), []);
  const speedDown = useCallback(() => setSpeedIndex((i) => Math.min(SPEEDS.length - 1, i + 1)), []);
  const resetSpeed = useCallback(() => setSpeedIndex(SPEEDS.indexOf(1)), []);

  const onTimeUpdate = useCallback(() => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, []);

  const onLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);

  return {
    videoRef,
    playing,
    speed,
    currentTime,
    duration,
    fps,
    setFps,
    fpsOverride,
    setFpsOverride,
    fpsError,
    effectiveFps,
    play,
    pause,
    togglePlay,
    seek,
    rewind,
    speedUp,
    speedDown,
    resetSpeed,
    onTimeUpdate,
    onLoadedMetadata,
    setPlaying
  };
}
