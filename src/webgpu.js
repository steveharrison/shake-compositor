// WebGPU over-composite: draw `overlay` on top of `background` using alpha.

const SHADER = /* wgsl */`
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VSOut {
  var p = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f( 1.0, -1.0), vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0), vec2f( 1.0, -1.0), vec2f( 1.0,  1.0),
  );
  var uv = array<vec2f, 6>(
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0),
    vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(1.0, 0.0),
  );
  var o: VSOut;
  o.pos = vec4f(p[i], 0.0, 1.0);
  o.uv = uv[i];
  return o;
}

@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var bgTex: texture_2d<f32>;
@group(0) @binding(2) var fgTex: texture_2d<f32>;

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let bg = textureSample(bgTex, samp, in.uv);
  let fg = textureSample(fgTex, samp, in.uv);
  let a = fg.a;
  let rgb = fg.rgb * a + bg.rgb * (1.0 - a);
  return vec4f(rgb, 1.0);
}
`;

let gpuState = null;

async function getGPU() {
  if (gpuState) return gpuState;
  if (!navigator.gpu) throw new Error('WebGPU is not supported in this browser.');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No WebGPU adapter available.');
  const device = await adapter.requestDevice();
  const format = navigator.gpu.getPreferredCanvasFormat();
  const module = device.createShaderModule({ code: SHADER });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });
  gpuState = { device, format, pipeline, sampler };
  return gpuState;
}

function bitmapToTexture(device, bitmap) {
  const texture = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });
  device.queue.copyExternalImageToTexture(
    { source: bitmap, flipY: false },
    { texture },
    [bitmap.width, bitmap.height],
  );
  return texture;
}

export async function renderComposite(canvas, background, overlay) {
  const { device, format, pipeline, sampler } = await getGPU();
  canvas.width = background.width;
  canvas.height = background.height;
  const context = canvas.getContext('webgpu');
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const bgTex = bitmapToTexture(device, background);
  const fgTex = bitmapToTexture(device, overlay);

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: bgTex.createView() },
      { binding: 2, resource: fgTex.createView() },
    ],
  });

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: 'clear',
      storeOp: 'store',
    }],
  });
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.draw(6);
  pass.end();
  device.queue.submit([encoder.finish()]);

  bgTex.destroy();
  fgTex.destroy();
}
