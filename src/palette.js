// 색 고르기: 16 / 32 / 64 / 128색의 '구분이 잘 되는' 고정 색판 (input[type=color]를 대신하는 팝업)
import { T } from './i18n.js';
import { lsGet, lsSet } from './store.js';

const hsl2hex = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + x(f(0)) + x(f(8)) + x(f(4));
};

// 16색: 손으로 고른 기본 색 (이름 포함)
const BASE16 = [
  ['#000000', '검정'], ['#404040', '진회색'], ['#808080', '회색'], ['#c0c0c0', '연회색'], ['#ffffff', '흰색'], ['#7c4a1e', '갈색'], ['#d62828', '빨강'], ['#f77f00', '주황'],
  ['#fcbf49', '노랑'], ['#a7c957', '연두'], ['#2a9d4a', '초록'], ['#00a6a6', '청록'], ['#48cae4', '하늘'], ['#1d4ed8', '파랑'], ['#7c3aed', '보라'], ['#ec4899', '분홍'],
];
// 색상환에서 눈으로 구분이 쉽도록 간격을 고른 색상(H)
const HUES8 = [0, 28, 52, 120, 175, 212, 270, 322];
const HUES16 = [0, 14, 30, 44, 56, 80, 110, 140, 165, 185, 205, 225, 250, 275, 300, 330];
const TIERS = {
  3: [[32, 78], [50, 86], [74, 80]],
  7: [[20, 70], [30, 80], [42, 88], [53, 90], [64, 88], [76, 80], [88, 70]],
};
const grays = (n) => Array.from({ length: n }, (_, i) => hsl2hex(0, 0, Math.round((i / (n - 1)) * 100)));

const cache = {};
/** n = 16 | 32 | 64 | 128 → { list: [[hex, name?]], cols } */
export function paletteColors(n) {
  if (cache[n]) return cache[n];
  let out;
  if (n === 16) out = { list: BASE16, cols: 8 };
  else {
    const hues = n === 128 ? HUES16 : HUES8;
    const tiers = TIERS[n === 32 ? 3 : 7];
    const cols = hues.length;
    const list = grays(cols).map((h) => [h]);
    for (const [l, s] of tiers) for (const h of hues) list.push([hsl2hex(h, s, l)]);
    out = { list, cols };
  }
  return (cache[n] = out);
}

let pop = null;
let popFor = null;
function close() {
  if (pop) pop.remove();
  pop = null;
  popFor = null;
}
document.addEventListener('pointerdown', (e) => {
  if (pop && !pop.contains(e.target) && e.target !== popFor) close();
}, true);
document.addEventListener('keydown', (e) => e.key === 'Escape' && pop && close());

/** input[type=color] 를 누르면 색판이 열리게 함. extra(): 현재 그림에서 쓰인 색 등 추가 색 목록 */
export function attachPalette(input, extra) {
  input.addEventListener('click', (e) => {
    e.preventDefault();
    if (popFor === input) return close();
    close();
    open(input, extra);
  });
}

function open(input, extra) {
  popFor = input;
  const host = input.closest('dialog') || document.body;
  pop = document.createElement('div');
  pop.className = 'palpop';
  const cur = (input.value || '').toLowerCase();
  let n = parseInt(lsGet('svgforge.palN'), 10);
  if (![16, 32, 64, 128].includes(n)) n = 32;
  const pick = (hex) => {
    input.value = hex;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  const head = document.createElement('div');
  head.className = 'palhead';
  const sel = document.createElement('select');
  for (const v of [16, 32, 64, 128]) sel.add(new Option(T('{n}색', { n: v }), String(v)));
  sel.value = String(n);
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'btn small';
  more.textContent = T('직접 고르기…');
  more.onclick = () => {
    close();
    input.showPicker ? input.showPicker() : input.click();
  };
  head.append(sel, more);
  pop.append(head);
  const body = document.createElement('div');
  pop.append(body);
  const draw = () => {
    body.innerHTML = '';
    const ex = (extra && extra()) || [];
    if (ex.length) {
      const lab = document.createElement('div');
      lab.className = 'pallab';
      lab.textContent = T('지금 그림의 색');
      const row = document.createElement('div');
      row.className = 'palgrid';
      row.style.gridTemplateColumns = 'repeat(8, 22px)';
      for (const hex of ex) row.append(sw(hex, hex));
      body.append(lab, row);
    }
    const { list, cols } = paletteColors(n);
    const g = document.createElement('div');
    g.className = 'palgrid';
    g.style.gridTemplateColumns = `repeat(${cols}, 22px)`;
    for (const [hex, name] of list) g.append(sw(hex, name ? `${T(name)} ${hex}` : hex));
    body.append(g);
  };
  const sw = (hex, title) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'palsw' + (hex.toLowerCase() === cur ? ' sel' : '');
    b.style.background = hex;
    b.title = title;
    b.onclick = () => pick(hex);
    return b;
  };
  sel.onchange = () => {
    n = parseInt(sel.value, 10);
    lsSet('svgforge.palN', String(n));
    draw();
    place();
  };
  draw();
  host.append(pop);
  const place = () => {
    const r = input.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    let y = r.bottom + 6;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
    pop.style.left = x + 'px';
    pop.style.top = y + 'px';
  };
  place();
}
