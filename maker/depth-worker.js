/* Runs Depth Anything V2 (small, int8) with ONNX Runtime Web off the main thread.
   in:  {type:"run", input: Float32Array(1*3*518*518)}
   out: {type:"progress", stage, loaded, total} | {type:"result", depth: Float32Array(518*518)} | {type:"error", message} */
importScripts("vendor/ort.wasm.min.js");
ort.env.wasm.wasmPaths = new URL("vendor/", self.location.href).href;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

const MODEL_URL = new URL("model/depth-anything-v2-small-q8.onnx?v=1", self.location.href).href;
const CACHE = "gyro-holo-model-v1";
let session = null;

async function fetchModel() {
  let cache = null;
  try { cache = await caches.open(CACHE); const hit = await cache.match(MODEL_URL); if (hit) { postMessage({ type: "progress", stage: "cache" }); return new Uint8Array(await hit.arrayBuffer()); } } catch (_) { cache = null; }
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error("模型下載失敗 HTTP " + res.status);
  const total = +res.headers.get("content-length") || 35313034;
  const reader = res.body.getReader(); const chunks = []; let loaded = 0, lastPost = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    chunks.push(value); loaded += value.length;
    const now = Date.now(); if (now - lastPost > 100) { lastPost = now; postMessage({ type: "progress", stage: "download", loaded, total }); }
  }
  const buf = new Uint8Array(loaded); let o = 0; for (const c of chunks) { buf.set(c, o); o += c.length; }
  if (cache) { try { await cache.put(MODEL_URL, new Response(buf, { headers: { "content-type": "application/octet-stream" } })); } catch (_) {} }
  return buf;
}

function getSession() {
  if (!session) session = (async () => {
    const bytes = await fetchModel();
    postMessage({ type: "progress", stage: "init" });
    return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  })().catch(e => { session = null; throw e; });
  return session;
}

onmessage = async e => {
  const m = e.data;
  try {
    if (m.type === "warm") { await getSession(); postMessage({ type: "ready" }); return; }
    if (m.type !== "run") return;
    const s = await getSession();
    postMessage({ type: "progress", stage: "infer" });
    const t0 = performance.now();
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor("float32", m.input, [1, 3, 518, 518]) });
    const depth = out[s.outputNames[0]].data;
    postMessage({ type: "result", depth, ms: Math.round(performance.now() - t0) }, [depth.buffer]);
  } catch (err) {
    postMessage({ type: "error", message: String(err && err.message || err) });
  }
};
