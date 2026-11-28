import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RLCParams, ThemeMode, analyzeRLC, evaluateRLC } from './rlc/rlcModel';
import { downloadMatplotlibFigure } from './rlc/exportFigure';
import { FocusedComponent, ParameterSidebar } from './components/ParameterSidebar';
import { CircuitSchematic } from './components/CircuitSchematic';
import { WaveformChart } from './components/WaveformChart';
import { SolutionDrawer } from './components/SolutionDrawer';

const STORAGE_THEME_KEY = 'rlc_theme_v1';

const INITIAL_PARAMS: RLCParams = {
  R: 40.0,
  L: 0.5,
  C: 0.002,
  E0: 24.0,
  gamma: 60.0,
  q0: 0.0,
  i0: 0.0,
};

export function App() {
  const [params, setParams] = useState<RLCParams>(INITIAL_PARAMS);
  const [windowSpan, setWindowSpan] = useState<number>(0.4);

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
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const system = useMemo(() => analyzeRLC(params), [params]);
  const instant = useMemo(() => evaluateRLC(system, currentTime), [system, currentTime]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

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

  const handleChangeParams = useCallback((patch: Partial<RLCParams>) => {
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'r') {
        handleReset();
      } else if (e.key === 'Escape') {
        setDrawerOpen(false);
        setFocusedComponent(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleReset]);

  return (
    <div className="rlc-shell">
      <main className="rlc-workspace">
        <ParameterSidebar
          params={params}
          system={system}
          theme={theme}
          focusedComponent={focusedComponent}
          onChangeParams={handleChangeParams}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
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
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            theme={theme}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onReset={handleReset}
            onScrubTime={handleScrubTime}
            onChangeSpeed={setPlaybackSpeed}
            onChangeWindowSpan={setWindowSpan}
            onExportFigure={() =>
              downloadMatplotlibFigure(system, currentTime, windowSpan)
            }
          />
        </div>
      </main>

      <SolutionDrawer
        open={drawerOpen}
        system={system}
        currentTime={currentTime}
        onToggle={() => setDrawerOpen((o) => !o)}
        onClose={() => {
          setDrawerOpen(false);
          setFocusedComponent(null);
        }}
        onHighlightComponent={setFocusedComponent}
      />
    </div>
  );
}

export default App;
