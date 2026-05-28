import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow';
import 'reactflow/dist/style.css';
import './App.css';

import { SourceNode, MaskNode, FillNode, ResultNode } from './nodes/CustomNodes';
import PolygonEditor from './PolygonEditor';
import ResultPreview from './ResultPreview';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|mkv|m4v)$/i;

const NODE_TYPES = {
  source: SourceNode,
  mask: MaskNode,
  fill: FillNode,
  result: ResultNode,
};

let nodeIdCounter = 1;
const nextId = () => `n${nodeIdCounter++}`;

const INITIAL_NODES = [
  {
    id: 'result',
    type: 'result',
    position: { x: 700, y: 200 },
    data: { kind: 'result' },
  },
];

export default function App() {
  const [sources, setSources] = useState([]); // [{id, name, kind, handle}]
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const flowWrapRef = useRef(null);
  const [rfInstance, setRfInstance] = useState(null);

  const sourceLookup = useCallback(
    (id) => sources.find((s) => s.id === id),
    [sources],
  );

  // Inject helpers into node data so nodes can reach live state
  const injectedNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          _sourceLookup: sourceLookup,
          _onPreview: n.type === 'result' ? () => setPreviewId(n.id) : undefined,
        },
      })),
    [nodes, sourceLookup],
  );

  const onNodesChange = useCallback(
    (changes) => setNodes((n) => applyNodeChanges(changes, n)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((e) => applyEdgeChanges(changes, e)),
    [],
  );
  const onConnect = useCallback(
    (c) =>
      setEdges((e) => {
        const filtered = e.filter(
          (ed) => !(ed.target === c.target && ed.targetHandle === c.targetHandle),
        );
        return addEdge({ ...c, animated: true }, filtered);
      }),
    [],
  );

  async function pickFolder() {
    if (!window.showDirectoryPicker) {
      alert('window.showDirectoryPicker is not available in this browser. Use Chrome or Edge.');
      return;
    }
    try {
      const dir = await window.showDirectoryPicker();
      const found = [];
      for await (const entry of dir.values()) {
        if (entry.kind !== 'file') continue;
        const isImg = IMAGE_EXT.test(entry.name);
        const isVid = VIDEO_EXT.test(entry.name);
        if (!isImg && !isVid) continue;
        found.push({
          id: `src-${entry.name}-${found.length}`,
          name: entry.name,
          kind: isImg ? 'image' : 'video',
          handle: entry,
        });
      }
      setSources(found);
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  }

  // Drag from sidebar onto canvas
  function onDragStart(e, payload) {
    e.dataTransfer.setData('application/x-shake', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function onDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-shake');
    if (!raw || !rfInstance) return;
    const payload = JSON.parse(raw);
    const position = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    if (payload.type === 'source') {
      const src = sources.find((s) => s.id === payload.sourceId);
      if (!src) return;
      setNodes((n) => [
        ...n,
        {
          id: nextId(),
          type: 'source',
          position,
          data: { kind: 'source', sourceId: src.id, sourceName: src.name },
        },
      ]);
    } else if (payload.type === 'mask') {
      setNodes((n) => [
        ...n,
        {
          id: nextId(),
          type: 'mask',
          position,
          data: {
            kind: 'mask',
            points: [
              { x: 0.25, y: 0.2 },
              { x: 0.75, y: 0.2 },
              { x: 0.75, y: 0.8 },
              { x: 0.25, y: 0.8 },
            ],
          },
        },
      ]);
    } else if (payload.type === 'fill') {
      setNodes((n) => [
        ...n,
        {
          id: nextId(),
          type: 'fill',
          position,
          data: { kind: 'fill', color: '#2563eb' },
        },
      ]);
    } else if (payload.type === 'result') {
      setNodes((n) => [
        ...n,
        { id: nextId(), type: 'result', position, data: { kind: 'result' } },
      ]);
    }
  }

  const selected = injectedNodes.find((n) => n.id === selectedId);

  function updateSelectedData(patch) {
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    );
  }

  return (
    <div className="app">
      <div className="sidebar">
        <h3>Sources</h3>
        <button onClick={pickFolder} style={{ width: '100%', marginBottom: 8 }}>
          Pick folder…
        </button>
        <div className="source-list">
          {sources.length === 0 && (
            <div className="small muted">No folder picked yet. Sources appear here — drag them into the canvas.</div>
          )}
          {sources.map((s) => (
            <SourceThumb
              key={s.id}
              source={s}
              onDragStart={(e) => onDragStart(e, { type: 'source', sourceId: s.id })}
            />
          ))}
        </div>

        <h3>Nodes</h3>
        <div className="palette">
          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, { type: 'mask' })}
          >
            🟪 Mask (polygon)
          </div>
          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, { type: 'fill' })}
          >
            🎨 Fill (colour)
          </div>
          <div
            className="palette-item"
            draggable
            onDragStart={(e) => onDragStart(e, { type: 'result' })}
          >
            ⭐ Result
          </div>
        </div>
      </div>

      <div
        className="flow-wrap"
        ref={flowWrapRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <ReactFlow
          nodes={injectedNodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setRfInstance}
          onSelectionChange={({ nodes }) => setSelectedId(nodes[0]?.id ?? null)}
          fitView
        >
          <Background color="#2e303a" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      <div className="inspector">
        <h3>Inspector</h3>
        {!selected && <div className="small muted">Select a node to edit its properties.</div>}
        {selected?.data.kind === 'source' && (
          <div>
            <div className="row"><label>Source</label><span>{selected.data.sourceName}</span></div>
          </div>
        )}
        {selected?.data.kind === 'fill' && (
          <div>
            <div className="row">
              <label>Colour</label>
              <input
                type="color"
                value={selected.data.color || '#2563eb'}
                onChange={(e) => updateSelectedData({ color: e.target.value })}
              />
              <code style={{ fontSize: 11 }}>{selected.data.color}</code>
            </div>
          </div>
        )}
        {selected?.data.kind === 'mask' && (
          <div>
            <div className="row"><label>Polygon</label></div>
            <PolygonEditor
              points={selected.data.points || []}
              onChange={(points) => updateSelectedData({ points })}
            />
          </div>
        )}
        {selected?.data.kind === 'result' && (
          <div>
            <button onClick={() => setPreviewId(selected.id)}>View composite</button>
          </div>
        )}

        <h3>How to use</h3>
        <ol className="small muted" style={{ paddingLeft: 18, lineHeight: 1.5 }}>
          <li>Click “Pick folder…” and choose a folder with images/videos.</li>
          <li>Drag a source onto the canvas.</li>
          <li>Drag a Mask node, wire source → mask, edit the polygon.</li>
          <li>Drag a Fill node, wire mask → fill, set a colour.</li>
          <li>Wire fill → Result, click the Result node’s “View composite” button.</li>
        </ol>
      </div>

      {previewId && (
        <ResultPreview
          nodes={nodes}
          edges={edges}
          sources={sources}
          resultId={previewId}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}

function SourceThumb({ source, onDragStart }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let created = null;
    (async () => {
      try {
        const file = await source.handle.getFile();
        if (cancelled) return;
        created = URL.createObjectURL(file);
        setUrl(created);
      } catch {}
    })();
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [source]);

  return (
    <div className="source-item" draggable onDragStart={onDragStart}>
      {source.kind === 'image' ? (
        <img src={url || ''} alt="" />
      ) : (
        <video src={url || ''} />
      )}
      <span className="name" title={source.name}>{source.name}</span>
      <span className="small muted">{source.kind}</span>
    </div>
  );
}
