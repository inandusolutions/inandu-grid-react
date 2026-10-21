import { useRef, useState } from 'react';
import { FEATURES, readme, type DemoTab } from './features';
import { highlight } from './highlight';

// Stroke icons, 24x24 viewBox. Paths are deliberately simple.
const ICONS: Record<string, string> = {
  sort: 'M7 4v16M7 4 3.5 7.5M7 4l3.5 3.5M17 20V4M17 20l-3.5-3.5M17 20l3.5-3.5',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  download: 'M12 4v11M12 15l-4-4M12 15l4-4M4 20h16',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  columns: 'M4 5h16v14H4zM9.5 5v14M14.5 5v14',
  grid: 'M4 4h16v16H4zM4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16',
  zap: 'M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01',
  puzzle: 'M9 4h3a2 2 0 1 1 4 0h3v4a2 2 0 1 0 0 4v4h-4a2 2 0 1 0-4 0H7v-4a2 2 0 1 1 0-4V4h2Z',
  tree: 'M6 4v8a3 3 0 0 0 3 3h3M6 4a2 2 0 1 0 0 .01M6 9h6M15 15a2 2 0 1 0 4 0 2 2 0 0 0-4 0M13 9a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14',
};

function Icon({ name, size }: { name: string; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function FeatureExplorer({ onOpenDemo }: { onOpenDemo: (tab: DemoTab) => void }) {
  const [activeId, setActiveId] = useState(FEATURES[0].id);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const active = FEATURES.find(f => f.id === activeId) ?? FEATURES[0];

  const copyCode = () => {
    navigator.clipboard?.writeText(active.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const onKey = (e: React.KeyboardEvent) => {
    const i = FEATURES.findIndex(f => f.id === activeId);
    const next = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const target = FEATURES[(next + FEATURES.length) % FEATURES.length].id;
    setActiveId(target);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`#tab-${target}`)?.focus());
  };

  return (
    <div className="explorer">
      <div className="explorer-list" role="tablist" aria-label="Features" aria-orientation="vertical" ref={listRef} onKeyDown={onKey}>
        {FEATURES.map(f => (
          <button
            key={f.id}
            id={`tab-${f.id}`}
            role="tab"
            type="button"
            aria-selected={f.id === activeId}
            aria-controls={`panel-${f.id}`}
            tabIndex={f.id === activeId ? 0 : -1}
            className={`explorer-item tone-${f.tone} ${f.id === activeId ? 'active' : ''}`}
            onClick={() => setActiveId(f.id)}
          >
            <span className="chip" aria-hidden="true">
              <Icon name={f.icon} size={18} />
            </span>
            <span className="explorer-item-title">{f.title}</span>
          </button>
        ))}
      </div>

      <div id={`panel-${active.id}`} role="tabpanel" aria-labelledby={`tab-${active.id}`} className={`explorer-panel tone-${active.tone}`}>
        <div className="explorer-head">
          <span className="chip big" aria-hidden="true">
            <Icon name={active.icon} size={22} />
          </span>
          <h3>{active.title}</h3>
        </div>
        <p className="explorer-blurb">{active.blurb}</p>

        <div className="codebox">
          <div className="codebox-bar">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="codebox-name">{active.id}.tsx</span>
            <button className="copy-btn" type="button" onClick={copyCode}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="code-block" dangerouslySetInnerHTML={{ __html: highlight(active.code) }} />
        </div>

        <div className="explorer-actions">
          {active.demo && (
            <button className="btn solid" type="button" onClick={() => onOpenDemo(active.demo!)}>
              See it running ↑
            </button>
          )}
          <a className="btn" href={readme(active.doc)}>
            Read the docs →
          </a>
        </div>
      </div>
    </div>
  );
}
