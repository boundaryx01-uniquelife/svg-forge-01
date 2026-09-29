// AI 업스케일 (ESRGAN-slim, MIT, UpscalerJS) — 필요할 때만 불러오는 별도 묶음
// 모델 가중치는 파일 안에 포함되어 오프라인에서 동작한다.
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tfl from '@tensorflow/tfjs-layers';
import m2json from '../node_modules/@upscalerjs/esrgan-slim/models/x2/model.json';
import m2bin from '../node_modules/@upscalerjs/esrgan-slim/models/x2/group1-shard1of1.bin';
import m4json from '../node_modules/@upscalerjs/esrgan-slim/models/x4/model.json';
import m4bin from '../node_modules/@upscalerjs/esrgan-slim/models/x4/group1-shard1of1.bin';

const MODELS = { 2: [m2json, m2bin], 4: [m4json, m4bin] };
const cache = {};
let backendReady = null;

async function ready() {
  if (!backendReady) {
    backendReady = (async () => {
      try {
        await tf.setBackend('webgl');
      } catch (e) {
        await tf.setBackend('cpu');
      }
      await tf.ready();
      return tf.getBackend();
    })();
  }
  return backendReady;
}

async function getModel(scale) {
  if (cache[scale]) return cache[scale];
  const [json, bin] = MODELS[scale];
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const model = await tfl.loadLayersModel(
    tf.io.fromMemory({ modelTopology: json.modelTopology, weightSpecs: json.weightsManifest[0].weights, weightData: buf })
  );
  cache[scale] = model;
  return model;
}

/**
 * imgd: {width, height, data(RGBA)} → 같은 형식, 크기 ×scale.
 * 색은 모델로, 투명도는 부드러운 보간으로 확대한다. 타일 단위로 처리해 메모리를 아낀다.
 */
export async function upscale(imgd, scale, onProgress) {
  const backend = await ready();
  const model = await getModel(scale);
  const { width: w, height: h, data } = imgd;
  const W = w * scale, H = h * scale;
  const out = new Uint8ClampedArray(W * H * 4);
  // 흰 배경에 합성한 RGB
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = data[i * 4 + c] * a + 255 * (1 - a);
  }
  const T = 96, PAD = 8;
  const tilesX = Math.ceil(w / T), tilesY = Math.ceil(h / T);
  let done = 0;
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * T, y0 = ty * T;
      const x1 = Math.min(w, x0 + T), y1 = Math.min(h, y0 + T);
      const px0 = Math.max(0, x0 - PAD), py0 = Math.max(0, y0 - PAD);
      const px1 = Math.min(w, x1 + PAD), py1 = Math.min(h, y1 + PAD);
      const cw = px1 - px0, chh = py1 - py0;
      const crop = new Float32Array(cw * chh * 3);
      for (let y = 0; y < chh; y++) crop.set(rgb.subarray(((py0 + y) * w + px0) * 3, ((py0 + y) * w + px1) * 3), y * cw * 3);
      const res = tf.tidy(() => {
        const t = tf.tensor4d(crop, [1, chh, cw, 3]);
        return tf.clipByValue(model.predict(t), 0, 255);
      });
      const vals = await res.data();
      res.dispose();
      const ow = cw * scale;
      for (let y = (y0 - py0) * scale; y < (y1 - py0) * scale; y++) {
        for (let x = (x0 - px0) * scale; x < (x1 - px0) * scale; x++) {
          const gi = ((py0 * scale + y) * W + (px0 * scale + x)) * 4;
          const si = (y * ow + x) * 3;
          out[gi] = vals[si];
          out[gi + 1] = vals[si + 1];
          out[gi + 2] = vals[si + 2];
        }
      }
      done++;
      if (onProgress) onProgress(done / (tilesX * tilesY));
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  // 투명도: 양선형 보간
  for (let Y = 0; Y < H; Y++) {
    const sy = Math.min(h - 1, Math.max(0, (Y + 0.5) / scale - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(h - 1, y0 + 1), fy = sy - y0;
    for (let X = 0; X < W; X++) {
      const sx = Math.min(w - 1, Math.max(0, (X + 0.5) / scale - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(w - 1, x0 + 1), fx = sx - x0;
      const a =
        (data[(y0 * w + x0) * 4 + 3] * (1 - fx) + data[(y0 * w + x1) * 4 + 3] * fx) * (1 - fy) +
        (data[(y1 * w + x0) * 4 + 3] * (1 - fx) + data[(y1 * w + x1) * 4 + 3] * fx) * fy;
      out[(Y * W + X) * 4 + 3] = a;
    }
  }
  return { width: W, height: H, data: out, backend };
}

self.SVGForgeUpscale = { upscale };

// 워커로 실행될 때: 화면이 멈추지 않도록 백그라운드에서 계산
if (typeof document === 'undefined') {
  self.onmessage = async (e) => {
    const { id, width, height, buffer, scale } = e.data;
    try {
      const r = await upscale({ width, height, data: new Uint8ClampedArray(buffer) }, scale, (f) => self.postMessage({ id, progress: f }));
      self.postMessage({ id, done: true, width: r.width, height: r.height, buffer: r.data.buffer, backend: r.backend }, [r.data.buffer]);
    } catch (err) {
      self.postMessage({ id, error: String((err && err.message) || err) });
    }
  };
}
