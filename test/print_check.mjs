// 출력 불가 가능 부분 탐지: 가는 선·작은 조각·작은 구멍
import { printabilityReport } from '../src/solid.js';
const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const model = (rings, H = 30) => ({ height: H, layers: [{ color: '#000', items: rings.map((r) => ({ poly: r })) }] });
const r1 = printabilityReport(model([rect(0, 0, 20, 20)]));                  // 정상
const r2 = printabilityReport(model([rect(0, 0, 20, 20), rect(25, 0, 0.3, 15)])); // 0.3mm 가는 막대
const r3 = printabilityReport(model([rect(0, 0, 20, 20), rect(25, 0, 0.6, 0.6)])); // 작은 점
const r4 = printabilityReport(model([rect(0, 0, 20, 20), rect(5, 5, 0.5, 0.5)]));  // 작은 구멍(evenodd)
const tri = [[0, 0], [10, 0], [5, 30]];                                        // 뾰족한 삼각형 (끝이 가늘어짐)
const r5 = printabilityReport(model([tri]));
const r6 = printabilityReport(model([rect(0, 0, 20, 20), rect(20, 9, 8, 0.3)])); // 몸체에 붙은 가는 수염
console.log('tri', r5.thin, 'whisker', r6.thin);
console.log(JSON.stringify([r1, r2, r3, r4].map(({ thin, island, hole }) => ({ thin, island, hole }))));
const ok = r1.thin + r1.island + r1.hole === 0 && r2.thin >= 1 && r3.island === 1 && r4.hole === 1 && r5.thin === 0 && r6.thin >= 1;
console.log(ok ? 'OK' : 'FAIL');
process.exit(ok ? 0 : 1);
