// Predeclared replay expectations; this gate does not score semantic quality.
import { readFile } from 'node:fs/promises';
const phase=process.argv[2];if(!['baseline','candidate'].includes(phase))throw new Error('Use baseline|candidate');
const data=JSON.parse(await readFile(new URL(`../../docs/test/results/scrum121/${phase}.json`,import.meta.url),'utf8'));
const failures=[];
if(data.attempts.length!==20)failures.push('Expected all 20 attempts; omitted/error attempts cannot be replaced.');
for(const a of data.attempts){
 const cap=a.id==='S02-after-3'||a.id==='S06-after-3';
 const flexible=a.id==='S03-after-3'||a.id==='S05-after-3';
 const expected=cap?['next_topic']:flexible?['follow_up','next_topic']:['follow_up'];
 if(a.status!=='valid'||!expected.includes(a.output?.action))failures.push({id:a.id,status:a.status,expected,actual:a.output?.action});
}
console.log(JSON.stringify({phase,total:data.attempts.length,failures},null,2));if(failures.length)process.exitCode=1;
