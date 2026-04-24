import { useEffect, useRef, useState } from 'react';
import { evaluateGraph } from './graph';
import { renderComposite } from './webgpu';

export default function ResultPreview({ nodes, edges, sources, resultId, onClose }) {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      try {
        const out = await evaluateGraph(nodes, edges, resultId, sources);
        if (cancelled) return;
        if (!out.background) throw new Error('No background source in the graph.');
        await renderComposite(canvasRef.current, out.background, out.bitmap);
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    }
    run();
    return () => { cancelled = true; };
  }, [nodes, edges, sources, resultId]);

  return (
    <div className="preview-modal" onClick={onClose}>
      <button className="close" onClick={onClose}>Close</button>
      <canvas ref={canvasRef} onClick={(e) => e.stopPropagation()} />
      {error && <div className="err">Error: {error}</div>}
      <div className="small muted">Rendered with WebGPU</div>
    </div>
  );
}
