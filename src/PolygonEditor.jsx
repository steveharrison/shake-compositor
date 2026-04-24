import { useRef, useState, useEffect } from 'react';

// Points are stored as normalized coords (0..1) on the mask node.
export default function PolygonEditor({ points, onChange, aspect = 16 / 9 }) {
  const svgRef = useRef(null);
  const [dragIdx, setDragIdx] = useState(null);
  const W = 320;
  const H = Math.round(W / aspect);

  function toLocal(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function handleSvgClick(e) {
    if (dragIdx !== null) return;
    if (e.target.tagName === 'circle') return;
    const p = toLocal(e);
    onChange([...(points || []), p]);
  }

  useEffect(() => {
    if (dragIdx === null) return;
    function move(e) {
      const p = toLocal(e);
      const next = points.map((pt, i) => (i === dragIdx ? p : pt));
      onChange(next);
    }
    function up() { setDragIdx(null); }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [dragIdx, points, onChange]);

  const poly = (points || []).map((p) => `${p.x * W},${p.y * H}`).join(' ');

  return (
    <div className="polygon-editor">
      <div className="hint">Click to add a point · drag a point to move · right-click a point to delete</div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        onClick={handleSvgClick}
        style={{ cursor: 'crosshair' }}
      >
        <rect x="0" y="0" width={W} height={H} fill="#1a1b22" />
        {points && points.length >= 3 && (
          <polygon points={poly} fill="rgba(168,85,247,0.3)" stroke="#a855f7" strokeWidth="1.5" />
        )}
        {points && points.length > 0 && points.length < 3 && (
          <polyline points={poly} fill="none" stroke="#a855f7" strokeWidth="1.5" />
        )}
        {(points || []).map((p, i) => (
          <circle
            key={i}
            cx={p.x * W}
            cy={p.y * H}
            r="5"
            fill="#a855f7"
            stroke="#fff"
            strokeWidth="1.5"
            style={{ cursor: 'grab' }}
            onMouseDown={(e) => { e.stopPropagation(); setDragIdx(i); }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange(points.filter((_, j) => j !== i));
            }}
          />
        ))}
      </svg>
      <div style={{ padding: 6, display: 'flex', gap: 6 }}>
        <button onClick={() => onChange([])}>Clear</button>
        <button
          onClick={() =>
            onChange([
              { x: 0.25, y: 0.2 },
              { x: 0.75, y: 0.2 },
              { x: 0.75, y: 0.8 },
              { x: 0.25, y: 0.8 },
            ])
          }
        >
          Reset to box
        </button>
      </div>
    </div>
  );
}
