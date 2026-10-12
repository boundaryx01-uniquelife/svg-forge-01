import { T } from './i18n.js';
// 색 고르기: RGB 선택창 대신 5×5 색 타일 (색을 구분하기만 하면 되므로)
export const TILES = [
  '#000000', '#4d4d4d', '#999999', '#cccccc', '#ffffff',
  '#e53935', '#fb8c00', '#fdd835', '#7cb342', '#2e7d32',
  '#00897b', '#00acc1', '#29b6f6', '#1e5fd6', '#1a237e',
  '#8e24aa', '#d81b60', '#f48fb1', '#795548', '#bcaaa4',
  '#ffcc80', '#a5d6a7', '#90caf9', '#ce93d8', '#c9a227',
];

let pop = null;
function closePop() {
  if (pop) pop.remove();
  pop = null;
}
function openPop(btn, inp, extra) {
  closePop();
  pop = document.createElement('div');
  pop.className = 'tilepop';
  const cur = (inp.value || '').toLowerCase();
  const mk = (c) => {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'tile' + (c === cur ? ' on' : '');
    t.style.background = c;
    t.title = c;
    t.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      inp.value = c;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      closePop();
    };
    return t;
  };
  for (const c of TILES) pop.appendChild(mk(c));
  const ex = (extra ? extra() : []).filter((c) => !TILES.includes(c.toLowerCase())).slice(0, 10);
  if (ex.length) {
    const lb = document.createElement('div');
    lb.className = 'tilelbl';
    lb.textContent = T('그림에 쓰인 색');
    pop.appendChild(lb);
    for (const c of ex) pop.appendChild(mk(c));
  }
  (btn.closest('dialog') || document.body).appendChild(pop);
  const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = Math.max(4, Math.min(innerWidth - pw - 4, r.left)) + 'px';
  pop.style.top = (r.bottom + ph + 8 > innerHeight ? Math.max(4, r.top - ph - 4) : r.bottom + 4) + 'px';
}

export function enhanceColorInputs(root = document, extra) {
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  root.querySelectorAll('input[type=color]').forEach((inp) => {
    if (inp.dataset.tiles) return;
    inp.dataset.tiles = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swbtn';
    btn.title = inp.title || '';
    const paint = () => (btn.style.background = proto.get.call(inp));
    Object.defineProperty(inp, 'value', {
      get() {
        return proto.get.call(this);
      },
      set(v) {
        proto.set.call(this, v);
        paint();
      },
    });
    inp.style.display = 'none';
    inp.addEventListener('input', paint);
    inp.addEventListener('change', paint);
    inp.after(btn);
    paint();
    btn.onclick = (e) => {
      e.stopPropagation();
      pop && pop._for === btn ? closePop() : (openPop(btn, inp, extra), pop && (pop._for = btn));
    };
    // 비활성 상태 따라가기
    const sync = () => (btn.disabled = inp.disabled);
    new MutationObserver(sync).observe(inp, { attributes: true, attributeFilter: ['disabled'] });
  });
}
document.addEventListener('click', (e) => {
  if (pop && !pop.contains(e.target)) closePop();
});
window.addEventListener('keydown', (e) => e.key === 'Escape' && closePop(), true);
