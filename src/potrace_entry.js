// Potrace 엔진 (GPL-2.0, http://potrace.sourceforge.net) — 선택 시에만 불러오는 별도 묶음
import { potrace, init } from 'esm-potrace-wasm';

let inited = null;
self.SVGForgePotrace = {
  async trace(imageData, opts) {
    if (!inited) inited = init();
    await inited;
    return potrace(imageData, { ...opts, pathonly: true, extractcolors: false, posterizelevel: 2, posterizationalgorithm: 0 });
  },
};
