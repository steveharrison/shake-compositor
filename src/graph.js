// Graph evaluation. Each node produces an output object:
//   { bitmap, width, height, background }
// where `bitmap` is the current RGBA frame and `background` is the
// original source image to be used as the backdrop in the final composite.

async function loadSourceBitmap(source) {
  if (source._bitmapPromise) return source._bitmapPromise;
  source._bitmapPromise = (async () => {
    const file = await source.handle.getFile();
    if (source.kind === 'image') {
      return await createImageBitmap(file);
    }
    // video: grab first frame
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = reject;
    });
    video.currentTime = 0;
    await new Promise((r) => { video.onseeked = r; });
    const bmp = await createImageBitmap(video);
    URL.revokeObjectURL(url);
    return bmp;
  })();
  return source._bitmapPromise;
}

function rasterizePolygonAlpha(width, height, points) {
  // returns ImageBitmap whose alpha is 255 inside polygon, 0 outside.
  // RGB preserved as white; the Fill node will swap RGB.
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (points.length >= 3) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(points[0].x * width, points[0].y * height);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * width, points[i].y * height);
    }
    ctx.closePath();
    ctx.fill();
  }
  return canvas.transferToImageBitmap();
}

function applyFillColor(srcBitmap, color) {
  // srcBitmap carries alpha from the mask (white where opaque).
  // Output: color.rgb with alpha = srcBitmap.a
  const { width, height } = srcBitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(srcBitmap, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.transferToImageBitmap();
}

export async function evaluateGraph(nodes, edges, resultNodeId, sources) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map();

  async function evalNode(id) {
    if (cache.has(id)) return cache.get(id);
    const node = nodeMap.get(id);
    if (!node) throw new Error(`Missing node ${id}`);

    const inputs = {};
    for (const edge of edges) {
      if (edge.target === id) {
        inputs[edge.targetHandle || 'in'] = await evalNode(edge.source);
      }
    }

    let out;
    switch (node.data.kind) {
      case 'source': {
        const src = sources.find((s) => s.id === node.data.sourceId);
        if (!src) throw new Error(`Source "${node.data.sourceName || ''}" not found. Pick a folder or reattach.`);
        const bmp = await loadSourceBitmap(src);
        out = { bitmap: bmp, width: bmp.width, height: bmp.height, background: bmp };
        break;
      }
      case 'mask': {
        const input = inputs.in;
        if (!input) throw new Error('Mask node has no input connected.');
        const points = node.data.points || [];
        if (points.length < 3) throw new Error('Mask needs at least 3 polygon points.');
        const matte = rasterizePolygonAlpha(input.width, input.height, points);
        out = { bitmap: matte, width: input.width, height: input.height, background: input.background };
        break;
      }
      case 'fill': {
        const input = inputs.in;
        if (!input) throw new Error('Fill node has no input connected.');
        const filled = applyFillColor(input.bitmap, node.data.color || '#2563eb');
        out = { bitmap: filled, width: input.width, height: input.height, background: input.background };
        break;
      }
      case 'result': {
        const input = inputs.in;
        if (!input) throw new Error('Result node has no input connected.');
        out = input;
        break;
      }
      default:
        throw new Error(`Unknown node kind ${node.data.kind}`);
    }
    cache.set(id, out);
    return out;
  }

  return evalNode(resultNodeId);
}
