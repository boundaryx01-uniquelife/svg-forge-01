// 제작자 표기: 화면 오른쪽 아래 · 사용법 창 · 3MF 정보 · 콘솔에 들어가며, 지워져도 다시 나타납니다.
import { T } from './i18n.js';
export const CREDIT = { author: 'uniquelife', tool: 'Claude', year: 2026 };
const a = () => `© ${CREDIT.year} ${CREDIT.author}`;

function build() {
  const t = T('Claude로 제작');
  return `${a()} · ${t}`;
}
let obs = null;
let busy = false;
function mount() {
  if (busy) return;
  busy = true;
  if (obs) obs.disconnect();
  try {
    mountInner();
  } finally {
    busy = false;
    if (obs && watchEl()) obs.observe(watchEl(), OBS);
  }
}
const watchEl = () => document.querySelector('.statusrow');
const OBS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] };
function mountInner() {
  const row = document.querySelector('.statusrow');
  if (!row) return;
  let c = document.getElementById('credit');
  if (!c || c.parentNode !== row || row.lastElementChild !== c) {
    if (c) c.remove();
    c = document.createElement('div');
    c.id = 'credit';
    row.appendChild(c);
  }
  const txt = build();
  if (c.textContent !== txt) c.textContent = txt;
  const tip = 'SVG Forge — ' + a() + ' · Made with Claude (Anthropic)';
  if (c.title !== tip) c.title = tip;
  if (c.getAttribute('style')) c.removeAttribute('style'); // 숨기기 스타일이 붙으면 지움
  if (c.hidden) c.hidden = false;
  // 사용법 창에도
  const f = document.querySelector('#help form');
  if (f) {
    let p = document.getElementById('aboutCredit');
    if (!p) {
      p = document.createElement('p');
      p.id = 'aboutCredit';
      p.className = 'hint';
      f.insertBefore(p, f.lastElementChild);
    }
    const t2 = `SVG Forge · ${a()} · ${T('Claude로 제작')}`;
    if (p.textContent !== t2) p.textContent = t2;
  }
}
export function startCredit() {
  mount();
  try {
    console.info(`%cSVG Forge%c ${a()} · Made with Claude`, 'font-weight:700', '');
  } catch (e) {}
  // 지우거나 바꾸면 곧바로 되돌림
  try {
    obs = new MutationObserver(() => mount());
    if (watchEl()) obs.observe(watchEl(), OBS);
  } catch (e) {}
  setInterval(mount, 3000);
}
