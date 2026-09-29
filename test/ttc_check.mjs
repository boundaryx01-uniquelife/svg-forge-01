import { readFileSync } from 'fs';
import opentype from 'opentype.js';
import { isCollection, splitCollection, fontDisplayName, fontPostscript } from '../src/fontutil.js';
for (const f of ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']) {
  const b=readFileSync(f); const buf=b.buffer.slice(b.byteOffset,b.byteOffset+b.length);
  console.log(f.split('/').pop(), 'ttc?', isCollection(buf));
  const t0=Date.now(); const parts=splitCollection(buf);
  for (const p of parts.slice(0,6)) { try { const font=opentype.parse(p); const path=font.getPath('가A',0,100,100); console.log('  ', fontDisplayName(font,'?'), '|', fontPostscript(font), '| glyph cmds', path.commands.length, (p.byteLength/1e6).toFixed(1)+'MB'); } catch(e) { console.log('  parse fail', e.message); } }
  console.log('  split', Date.now()-t0,'ms', parts.length,'fonts');
}
