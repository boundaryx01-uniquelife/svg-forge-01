import { readFileSync } from 'fs';
import { estimateHardEdges } from '../src/trace.js';
const sets={transparent:[500,500],logo:[800,600],truth_800:[800,600],user_uniquelife:[1150,443],multi:[600,400],touching:[800,500],user800:[800,308]};
for(const [n,[w,h]] of Object.entries(sets)){ const d=new Uint8ClampedArray(readFileSync(`/tmp/claude-0/${n}.bin`)); console.log(n.padEnd(16), estimateHardEdges({width:w,height:h,data:d}).toFixed(3)); }
