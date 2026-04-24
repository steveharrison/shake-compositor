import { Handle, Position } from 'reactflow';
import { useEffect, useRef } from 'react';

function Header({ kind, label, children }) {
  return (
    <div className={`node-header ${kind}`}>
      <span>{label}</span>
      {children}
    </div>
  );
}

export function SourceNode({ data, selected }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const src = data._sourceLookup?.(data.sourceId);
      if (!src || !ref.current) return;
      try {
        const file = await src.handle.getFile();
        if (cancelled) return;
        if (src.kind === 'image') {
          ref.current.src = URL.createObjectURL(file);
        } else {
          ref.current.src = URL.createObjectURL(file);
        }
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, [data.sourceId]);

  return (
    <div className={`node${selected ? ' selected' : ''}`}>
      <Header kind="source" label="Source" />
      <div className="node-body">
        <img ref={ref} className="node-thumb" alt="" />
        <div className="small" style={{ marginTop: 4 }}>{data.sourceName || '(no source)'}</div>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function MaskNode({ data, selected }) {
  return (
    <div className={`node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <Header kind="mask" label="Mask" />
      <div className="node-body">
        <div className="small">Polygon points: {(data.points || []).length}</div>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function FillNode({ data, selected }) {
  return (
    <div className={`node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <Header kind="fill" label="Fill" />
      <div className="node-body">
        <div className="swatch" style={{ background: data.color || '#2563eb' }} />
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}

export function ResultNode({ data, selected }) {
  return (
    <div className={`node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} id="in" />
      <Header kind="result" label="Result" />
      <div className="node-body">
        <button onClick={(e) => { e.stopPropagation(); data._onPreview?.(); }}>
          View composite
        </button>
      </div>
    </div>
  );
}
