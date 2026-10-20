const W=800,H=520,R=20,svg=document.getElementById('g');
const PAL=['#e4572e','#2e86de','#3cb371','#f2b134','#9b59b6','#17bebb','#ef6fa5','#8d6e63','#7cb342','#5c6bc0','#ff8f00','#26a69a'];
const col=c=>c<0?'transparent':(c<PAL.length?PAL[c]:`hsl(${(c*47)%360} 60% 55%)`);
let nodes=[],edges=[],nid=0,tool='node',sel=null,drag=null,gen=null,timer=null,steps=0,current=null;
const TOOLS={node:'Add node',edge:'Add edge',move:'Move',paint:'Paint',del:'Delete'};
const HINTS={node:'Click empty space to add a node.',edge:'Click two nodes to connect (or disconnect) them.',move:'Drag nodes to rearrange.',paint:'Click a node to cycle its color by hand.',del:'Click a node to remove it.'};
const $=id=>document.getElementById(id);
const tb=$('tools');
for(const k in TOOLS){const b=document.createElement('button');b.textContent=TOOLS[k];b.dataset.t=k;b.onclick=()=>{tool=k;sel=null;ui()};tb.appendChild(b)}
function ui(){[...tb.children].forEach(b=>b.classList.toggle('on',b.dataset.t===tool));$('hint').textContent=HINTS[tool];render()}
const key=(a,b)=>a<b?a+'-'+b:b+'-'+a;
const hasE=(a,b)=>edges.some(e=>key(e[0],e[1])===key(a,b));
function toggleEdge(a,b){if(hasE(a,b))edges=edges.filter(e=>key(e[0],e[1])!==key(a,b));else edges.push([a,b])}
const byId=id=>nodes.find(n=>n.id===id);
function addNode(x,y){nodes.push({id:nid++,x,y,c:-1})}
function pt(e){const r=svg.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
function hit(p){for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(Math.hypot(n.x-p.x,n.y-p.y)<=R+4)return n}return null}
svg.addEventListener('pointerdown',e=>{
 const p=pt(e),n=hit(p);
 if(tool!=='paint'&&tool!=='move')halt();
 if(!n){if(tool==='node'){addNode(p.x,p.y);resetColors(true)}sel=null;return render()}
 if(tool==='move'){drag=n;svg.setPointerCapture(e.pointerId)}
 else if(tool==='edge'){if(sel===null)sel=n.id;else{if(sel!==n.id){toggleEdge(sel,n.id);resetColors(true)}sel=null}}
 else if(tool==='del'){nodes=nodes.filter(m=>m!==n);edges=edges.filter(x=>x[0]!==n.id&&x[1]!==n.id);resetColors(true)}
 else if(tool==='paint'){halt();const used=Math.max(...nodes.map(m=>m.c),-1)+2;n.c=n.c+1>=Math.min(used,24)?-1:n.c+1}
 else if(tool==='node'){sel=null}
 render()});
svg.addEventListener('pointermove',e=>{if(!drag)return;const p=pt(e);drag.x=Math.max(R,Math.min(W-R,p.x));drag.y=Math.max(R,Math.min(H-R,p.y));render()});
svg.addEventListener('pointerup',()=>drag=null);
svg.addEventListener('pointercancel',()=>drag=null);
function render(){
 let h='',conf=0;
 for(const[a,b]of edges){const u=byId(a),v=byId(b),bad=u.c>=0&&u.c===v.c;if(bad)conf++;
  h+=`<line x1="${u.x}" y1="${u.y}" x2="${v.x}" y2="${v.y}" style="stroke:${bad?'var(--bad)':'var(--edge)'};stroke-width:${bad?4:2}"/>`}
 nodes.forEach((n,i)=>{const act=current===n.id,s=sel===n.id;
  h+=`<circle cx="${n.x}" cy="${n.y}" r="${R}" style="fill:${n.c<0?'var(--surface)':col(n.c)};stroke:${act||s?'var(--accent)':'var(--text)'};stroke-width:${act||s?5:2}"/>`+
  `<text x="${n.x}" y="${n.y+5}" text-anchor="middle" font-size="14" font-weight="600" style="pointer-events:none;fill:${n.c<0?'var(--text)':'#fff'}">${i+1}</text>`});
 svg.innerHTML=h;
 const used=new Set(nodes.filter(n=>n.c>=0).map(n=>n.c));
 const deg=degs();
 $('sColors').textContent=used.size;$('sConf').textContent=conf;$('sSteps').textContent=steps;
 $('sBound').textContent=nodes.length?Math.max(...deg)+1:'–';
 $('legend').innerHTML=[...used].sort((a,b)=>a-b).map(c=>`<div class="sw" title="color ${c+1}" style="background:${col(c)}"></div>`).join('');
}
function degs(){return nodes.map(n=>edges.filter(e=>e[0]===n.id||e[1]===n.id).length)}
function log(m){const l=$('log');l.insertAdjacentHTML('beforeend',`<div>${m}</div>`);while(l.children.length>150)l.removeChild(l.firstChild);l.scrollTop=l.scrollHeight}
function resetColors(quiet){halt();nodes.forEach(n=>n.c=-1);steps=0;current=null;if(!quiet)$('log').innerHTML='';render()}
function halt(){clearTimeout(timer);timer=null;gen=null;current=null;$('run').textContent='▶ Run'}

/* ---------- algorithms (generators yielding steps) ---------- */
function graph(){const idx=new Map(nodes.map((n,i)=>[n.id,i]));const adj=nodes.map(()=>[]);
 edges.forEach(([a,b])=>{adj[idx.get(a)].push(idx.get(b));adj[idx.get(b)].push(idx.get(a))});return adj}
function* greedy(order,adj,name){const c=nodes.map(()=>-1);
 yield{msg:`${name}: order = ${order.map(i=>i+1).join(', ')}`};
 for(const i of order){const used=new Set(adj[i].map(j=>c[j]));let k=0;while(used.has(k))k++;c[i]=k;
  yield{i,c:k,msg:`Node ${i+1}: neighbors use {${[...used].filter(x=>x>=0).map(x=>x+1).sort((a,b)=>a-b)}} → color ${k+1}`}}}
function* dsatur(adj){const c=nodes.map(()=>-1);
 for(let t=0;t<nodes.length;t++){let best=-1,bs=-1,bd=-1;
  for(let i=0;i<nodes.length;i++){if(c[i]>=0)continue;const s=new Set(adj[i].map(j=>c[j]).filter(x=>x>=0)).size;
   if(s>bs||(s===bs&&adj[i].length>bd)){best=i;bs=s;bd=adj[i].length}}
  const used=new Set(adj[best].map(j=>c[j]));let k=0;while(used.has(k))k++;c[best]=k;
  yield{i:best,c:k,msg:`Node ${best+1} has saturation ${bs}, degree ${bd} → color ${k+1}`}}}
function* backtrack(adj){const N=nodes.length,c=nodes.map(()=>-1);
 const order=[...Array(N).keys()].sort((a,b)=>adj[b].length-adj[a].length);
 let budget=40000;
 function* solve(pos,k,mx){
  if(pos===N)return true;const i=order[pos];
  for(let x=0;x<=Math.min(k-1,mx+1);x++){
   if(adj[i].some(j=>c[j]===x))continue;
   if(--budget<0)return false;
   c[i]=x;yield{i,c:x,msg:`Try node ${i+1} = color ${x+1}`};
   if(yield*solve(pos+1,k,Math.max(mx,x)))return true;
   c[i]=-1;yield{i,c:-1,msg:`Dead end → backtrack node ${i+1}`};
  }return false}
 const hasEdge=edges.length>0;
 for(let k=hasEdge?2:1;k<=N;k++){
  yield{msg:`— Searching for a ${k}-coloring —`};
  if(yield*solve(0,k,-1)){yield{msg:`Optimal! Chromatic number χ = ${k}`};return}
  if(budget<0){yield{msg:'Search budget exhausted (graph too large for exact search).'};return}
 }}
function makeGen(){const adj=graph(),a=$('algo').value,N=nodes.length;
 if(a==='greedy')return greedy([...Array(N).keys()],adj,'Greedy');
 if(a==='wp')return greedy([...Array(N).keys()].sort((x,y)=>adj[y].length-adj[x].length),adj,'Welsh–Powell');
 if(a==='dsatur')return dsatur(adj);
 return backtrack(adj)}
function advance(){
 if(!gen)return false;
 const r=gen.next();
 if(r.done){const u=new Set(nodes.map(n=>n.c)).size;log(`<b>Done</b> — ${u} color(s) used.`);halt();render();return false}
 const s=r.value;steps++;
 if(s.i!==undefined){nodes[s.i].c=s.c;current=nodes[s.i].id}else current=null;
 log(s.msg);render();return true}
function loop(){if(!timer&&timer!==0)return;const d=Math.round(1000*Math.pow(0.012,($('speed').value-1)/99));
 timer=setTimeout(()=>{if(advance())loop()},d)}
$('run').onclick=()=>{
 if(timer){clearTimeout(timer);timer=null;$('run').textContent='▶ Resume';return}
 if(!nodes.length)return log('Add some nodes first.');
 if(!gen){nodes.forEach(n=>n.c=-1);steps=0;$('log').innerHTML='';gen=makeGen()}
 $('run').textContent='❚❚ Pause';timer=setTimeout(()=>{},0);loop()};
$('step').onclick=()=>{if(!nodes.length)return;clearTimeout(timer);timer=null;$('run').textContent='▶ Resume';
 if(!gen){nodes.forEach(n=>n.c=-1);steps=0;$('log').innerHTML='';gen=makeGen()}advance()};
$('stop').onclick=()=>{halt();render()};
$('uncolor').onclick=()=>resetColors();
$('clear').onclick=()=>{halt();nodes=[];edges=[];nid=0;steps=0;sel=null;$('log').innerHTML='';render()};
$('algo').onchange=()=>{halt();render()};

/* ---------- presets ---------- */
function circle(n,r=190,cx=400,cy=260,off=-Math.PI/2){for(let i=0;i<n;i++)nodes.push({id:nid++,x:cx+r*Math.cos(off+2*Math.PI*i/n),y:cy+r*Math.sin(off+2*Math.PI*i/n),c:-1})}
$('preset').onchange=e=>{const v=e.target.value;e.target.value='';if(!v)return;halt();nodes=[];edges=[];nid=0;steps=0;sel=null;$('log').innerHTML='';
 const E=(a,b)=>edges.push([a,b]);
 if(v==='Petersen'){circle(5,200);const s=nodes.length;circle(5,100);for(let i=0;i<5;i++){E(i,(i+1)%5);E(i,5+i);E(5+i,5+(i+2)%5)}}
 else if(v==='K5'){circle(5,200);for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)E(i,j)}
 else if(v==='Wheel W6'){circle(6,200);addNode(400,260);for(let i=0;i<6;i++){E(i,(i+1)%6);E(i,6)}}
 else if(v==='Odd cycle C7'){circle(7,200);for(let i=0;i<7;i++)E(i,(i+1)%7)}
 else if(v==='Bipartite K3,3'){for(let i=0;i<3;i++){addNode(220,110+i*150)}for(let i=0;i<3;i++){addNode(580,110+i*150)}for(let i=0;i<3;i++)for(let j=3;j<6;j++)E(i,j)}
 else{const n=10;circle(n,200);nodes.forEach(m=>{m.x+=(Math.random()-.5)*60;m.y+=(Math.random()-.5)*40});
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.random()<.3)E(i,j)}
 render()};

ui();