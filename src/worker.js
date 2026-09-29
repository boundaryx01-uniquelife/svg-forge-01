// 백그라운드 트레이싱 워커: 화면이 멈추지 않도록 무거운 계산을 여기서 한다
import { traceImage } from './imagetrace.js';

self.onmessage = (e) => {
  const { id, width, height, buffer, opts } = e.data;
  try {
    const t0 = performance.now();
    const layers = traceImage({ width, height, data: new Uint8ClampedArray(buffer) }, opts);
    self.postMessage({ id, ok: true, layers: layers.map((l) => ({ color: l.color, rings: l.rings })), stats: layers.stats || {}, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
