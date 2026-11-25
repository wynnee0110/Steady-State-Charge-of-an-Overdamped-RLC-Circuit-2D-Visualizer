import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PRESETS, RLCParams, analyzeRLC, evaluateRLC } from './rlc/rlcModel';
import { Header, ThemeMode } from './components/Header';
import { FocusedComponent, ParameterSidebar } from './components/ParameterSidebar';
import { CircuitSchematic } from './components/CircuitSchematic';
import { WaveformChart } from './components/WaveformChart';
import { VerificationModal } from './components/VerificationModal';

const STORAGE_THEME_KEY = 'rlc_theme_v1';

export function App() {
  const [activePresetId, setActivePresetId] = useState<'case1' | 'case2' | 'case3' | null>('case1');
  const [params, setParams] = useState<RLCParams>(() => ({ ...PRESETS[0].params }));
  const [windowSpan, setWindowSpan] = useState<number>(PRESETS[0].tMax);
  const [checkpoints, setCheckpoints] = useState<number[]>(PRESETS[0].checkpoints);

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore storage errors
    }
    return 'dark';
  });

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.1);
  const [focusedComponent, setFocusedComponent] = useState<FocusedComponent>(null);
  const [verifyOpen, setVerifyOpen] = useState<boolean>(false);

  const system = useMemo(() => analyzeRLC(params), [params]);
  const instant = useMemo(() => evaluateRLC(system, currentTime), [system, currentTime]);

  // Apply theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Refs for smooth requestAnimationFrame loop without re-subscribing
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(playbackSpeed);
  const timeRef = useRef(currentTime);
  const lastFrameTsRef = useRef<number | null>(null);

  isPlayingRef.current = isPlaying;
  speedRef.current = playbackSpeed;
  timeRef.current = currentTime;

  useEffect(() => {
    let rafId = 0;
    const tick = (now: number) => {
      if (lastFrameTsRef.current === null) {
        lastFrameTsRef.current = now;
      }
      const elapsedSec = Math.min(0.05, Math.max(0, (now - lastFrameTsRef.current) / 1000));
      lastFrameTsRef.current = now;

      if (isPlayingRef.current) {
        const next = timeRef.current + elapsedSec * speedRef.current;
        timeRef.current = next;
        setCurrentTime(next);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleSelectPreset = useCallback((id: 'case1' | 'case2' | 'case3') => {
    const found = PRESETS.find((p) => p.id === id);
    if (!found) return;
    setActivePresetId(found.id);
    setParams({ ...found.params });
    setWindowSpan(found.tMax);
    setCheckpoints(found.checkpoints);
    timeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);
    setFocusedComponent(null);
  }, []);

  const handleChangeParams = useCallback((patch: Partial<RLCParams>) => {
    setActivePresetId(null);
    setParams((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleScrubTime = useCallback((t: number) => {
    const clamped = Math.max(0, t);
    timeRef.current = clamped;
    setCurrentTime(clamped);
  }, []);

  const handleReset = useCallback(() => {
    timeRef.current = 0;
    setCurrentTime(0);
  }, []);

  // Keyboard shortcuts: Space (play/pause), R (reset), 1/2/3 (presets), Escape (close modal)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'r') {
        handleReset();
      } else if (e.key === '1') {
        handleSelectPreset('case1');
      } else if (e.key === '2') {
        handleSelectPreset('case2');
      } else if (e.key === '3') {
        handleSelectPreset('case3');
      } else if (e.key === 'Escape') {
        setVerifyOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleReset, handleSelectPreset]);

  return (
    <div className="rlc-shell">
      <Header
        activePresetId={activePresetId}
        theme={theme}
        onSelectPreset={handleSelectPreset}
        onOpenVerification={() => setVerifyOpen(true)}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main className="rlc-workspace">
        <ParameterSidebar
          params={params}
          system={system}
          focusedComponent={focusedComponent}
          onChangeParams={handleChangeParams}
        />

        <div className="rlc-stage">
          <CircuitSchematic
            system={system}
            instant={instant}
            theme={theme}
            focusedComponent={focusedComponent}
            onFocusComponent={setFocusedComponent}
          />

          <WaveformChart
            system={system}
            instant={instant}
            currentTime={currentTime}
            windowSpan={windowSpan}
            checkpoints={checkpoints}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            theme={theme}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onReset={handleReset}
            onScrubTime={handleScrubTime}
            onChangeSpeed={setPlaybackSpeed}
            onChangeWindowSpan={setWindowSpan}
          />
        </div>
      </main>

      {verifyOpen && (
        <VerificationModal
          system={system}
          checkpoints={checkpoints}
          onClose={() => setVerifyOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
