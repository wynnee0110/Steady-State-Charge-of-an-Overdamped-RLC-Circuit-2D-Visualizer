import React from 'react';
import { FileCheck2, Moon, Sun } from 'lucide-react';
import { PRESETS } from '../rlc/rlcModel';

export type ThemeMode = 'dark' | 'light';

interface HeaderProps {
  activePresetId: string | null;
  theme: ThemeMode;
  onSelectPreset: (id: 'case1' | 'case2' | 'case3') => void;
  onOpenVerification: () => void;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activePresetId,
  theme,
  onSelectPreset,
  onOpenVerification,
  onToggleTheme,
}) => {
  return (
    <header
      style={{
        height: 52,
        padding: '0 16px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Left: Topic identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'var(--accent-soft)',
            border: '1px solid var(--border-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12c2-6 4-6 6 0s4 6 6 0 4-6 8-2" />
          </svg>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.015em', whiteSpace: 'nowrap' }}>
            Overdamped RLC
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Steady-State Charge · Math 221
          </span>
        </div>
      </div>

      {/* Center: Segmented Preset Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: 3,
          gap: 2,
        }}
      >
        {PRESETS.map((preset) => {
          const active = activePresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.subtitle}
              onClick={() => onSelectPreset(preset.id)}
              style={{
                padding: '5px 11px',
                borderRadius: 6,
                border: 'none',
                background: active ? 'var(--bg-panel)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 500,
                fontSize: 12,
                cursor: 'pointer',
                boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.16)' : 'none',
                whiteSpace: 'nowrap',
                transition: 'background 0.12s ease, color 0.12s ease',
              }}
            >
              {preset.shortLabel}
            </button>
          );
        })}
        {activePresetId === null && (
          <span
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--accent)',
            }}
          >
            Custom
          </span>
        )}
      </div>

      {/* Right: Derivation & RK45 + Theme */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={onOpenVerification}
          style={{
            height: 30,
            padding: '0 11px',
            borderRadius: 7,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <FileCheck2 size={14} color="var(--accent)" />
          <span>Derivation &amp; RK45</span>
        </button>

        <button
          type="button"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          onClick={onToggleTheme}
          style={{
            width: 30,
            height: 30,
            borderRadius: 7,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </header>
  );
};
