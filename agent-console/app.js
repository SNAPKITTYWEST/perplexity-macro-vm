// Perplexity Macro VM — Agent Console · Perplexity Desktop + Codex Sandbox + WebLLM→ABI→JIT Loop
// VM owns control (RQ→Router→Broker→TLV CRC16), WASM Box is execution boundary, WebLLM is instruct model.

const TOOLS = [
  { id:'search', cap:0x01, label:'search', icon:'◉', desc:'Tavily deep research', sensitive:false, tier:'research' },
  { id:'fetch', cap:0x02, label:'fetch', icon:'↗', desc:'Allowlisted GET', sensitive:false, tier:'research' },
  { id:'browser', cap:0x03, label:'browser', icon:'◫', desc:'Playwright', sensitive:true, tier:'sovereign' },
  { id:'code', cap:0x04, label:'code', icon:'λ', desc:'bwrap/nsjail', sensitive:true, tier:'sovereign' },
  { id:'local_model', cap:0x05, label:'local model', icon:'◇', desc:'Ollama', sensitive:false, tier:'local' },
  { id:'wikipedia', cap:0x06, label:'wikipedia', icon:'W', desc:'MediaWiki', sensitive:true, tier:'research' },
  { id:'mathematica', cap:0x07, label:'mathematica', icon:'∫', desc:'WolframAlpha', sensitive:true, tier:'research' },
  { id:'dictionary', cap:0x08, label:'dictionary', icon:'Aa', desc:'dictionaryapi', sensitive:false, tier:'research' },
  { id:'python.execute', cap:0x04, label:'python.execute', icon:'▶', desc:'WASM IPython', sensitive:false, tier:'sandbox' },
  { id:'python.inspect', cap:0x04, label:'python.inspect', icon:'◎', desc:'Inspect', sensitive:false, tier:'sandbox' },
  { id:'slc.evaluate', cap:null, label:'slc.evaluate', icon:'🛡', desc:'5-bank scan', sensitive:false, tier:'sovereign' },
  { id:'ere.score', cap:null, label:'ere.score', icon:'◐', desc:'Entropy', sensitive:false, tier:'sovereign' },
  { id:'quantum.temp', cap:null, label:'quantum.temp', icon:'∿', desc:'ANU QRNG', sensitive:false, tier:'quantum' },
  { id:'worm.seal', cap:null, label:'worm.seal', icon:'⬢', desc:'WORM', sensitive:false, tier:'sovereign' },
  { id:'worm.verify', cap:null, label:'worm.verify', icon:'✓', desc:'Verify', sensitive:false, tier:'sovereign' },
  { id:'swarm.run', cap:null, label:'swarm.run', icon:'⬡', desc:'Swarm', sensitive:false, tier:'sovereign' },
  { id:'agent.call', cap:null, label:'agent.call', icon:'⬔', desc:'BOB', sensitive:false, tier:'sovereign' },
  { id:'macrogrok.infer4', cap:0x04, label:'macrogrok.infer4', icon:'◈', desc:'Q1.14/Q3.12', sensitive:false, tier:'macrogrok' },
  { id:'regex.match', cap:null, label:'regex.match', icon:'≋', desc:'Regex', sensitive:false, tier:'sovereign' },
  { id:'metatron.phi', cap:null, label:'metatron.phi', icon:'φ', desc:'Phi', sensitive:false, tier:'sovereign' },
  { id:'metatron.cube', cap:null, label:'metatron.cube', icon:'⬣', desc:'Cube', sensitive:false, tier:'sovereign' },
  { id:'tavily.search', cap:0x01, label:'tavily.search', icon:'◎', desc:'Tavily', sensitive:false, tier:'research' },
];

let vm = { regs:{a:0,b:0,c:0,d:0, pc:0x0000, sp:0xDFFF, bp:0, flags:0}, cycles:0, retired:0, fuel:128, transcript_hash:0, trace_seq:0, waiting:false, halted:false, phase:0 };
let trace = []; let enabled = new Set(TOOLS.filter(t=>!t.sensitive).map(t=>t.id));
let pyodide=null, pyReady=false; let liveWS=null; let artifacts=[];
const $=s=>document.querySelector(s);

// DOM — new Perplexity desktop
const answerCanvas=$('#answerCanvas'), askInput=$('#askInput'), threadList=$('#threadList'), threadCount=$('#threadCount'), currentTaskEl=$('#currentTask'), vmBrief=$('#vmBrief');
const sourcesList=$('#sourcesList'), sourceCount=$('#sourceCount'), sourcesInline=$('#sourcesInline'), answerStatus=$('#answerStatus');
const codeArea=$('#codeArea'), gutter=$('#gutter'), termOut=$('#termOut'), termIn=$('#termIn'), artifactsEl=$('#artifacts'), filesList=$('#filesList');
const toolsListEl=$('#toolsList'), memoryEl=$('#memory'), regsLabel=$('#regsLabel'), pcLabel=$('#pcLabel'), fuelPill=$('#fuelPill'), hashPill=$('#hashPill'), vmStateEl=$('#vmState');
const fuelMini=$('#fuelMini'), hashMini=$('#hashMini'), cyclesMini=$('#cyclesMini'), traceBody=$('#traceBody'), statRetired=$('#statRetired'), statCoverage=$('#statCoverage');
const pyState=$('#pyState'), pyDot=$('#pyDot'), sandboxLabel=$('#sandboxLabel'), sandboxDot=$('#sandboxDot'), termStatus=$('#termStatus');
const modelDot=$('#modelDot'), modelStateEl=$('#modelState'), modelName=$('#modelName');
const agentSel=$('#agentSel');

// WebLLM — Worker (one model, kept in worker)
let webllmWorker=null, webllmReady=false, webllmLoading=false, webllmModel="Phi-3-mini-4k-instruct-q4f16_1-MLC";
const ABI_SYSTEM = `You are the instruct model for Perplexity Macro VM. Emit ONLY one JSON object per turn, no prose, no markdown, matching Instruction ABI:
{"op":"python","code":"..."} | {"op":"tool","name":"tavily.search|wikipedia|dictionary|mathematica|fetch","args":{"query":"..."}} | {"op":"vm","instruction":"..."} | {"op":"final","content":"..."}
Rules: one op per turn, code must be valid Python, args.query short, prefer python for computation then tool for evidence then final with synthesis. VM owns control, WASM Box is execution boundary.`;

// Render helpers
function renderTools(){
  if(!toolsListEl) return; toolsListEl.innerHTML='';
  TOOLS.forEach(t=>{
    const on=enabled.has(t.id);
    const row=document.createElement('div'); row.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:7px;border-radius:8px;background:rgba(255,255,255,.02);border:1px solid var(--line2)';
    row.innerHTML=`<div style="display:flex;gap:8px;align-items:center"><div style="width:20px;height:20px;border-radius:6px;display:grid;place-items:center;background:rgba(124,140,255,.08);border:1px solid rgba(124,140,255,.14);font-size:10px">${t.icon}</div><div><div style="font-size:10.5px;font-weight:500">${t.label}</div><div style="font-size:9px;color:var(--muted)">${t.desc} · ${t.tier}${t.sensitive?' · CONFIRM':''}</div></div></div><div style="display:flex;gap:6px;align-items:center"><span class="mono" style="font-size:8.5px;padding:2px 5px;border-radius:5px;background:rgba(0,0,0,.25);border:1px solid var(--line2)">${t.cap!==null?'0x'+t.cap.toString(16).padStart(2,'0'):'—'}</span><div class="toggle ${on?'on':''}" data-id="${t.id}" style="width:30px;height:18px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid var(--line);position:relative;cursor:pointer"><i style="position:absolute;top:2px;left:${on?'14px':'2px'};width:12px;height:12px;border-radius:50%;background:#fff;transition:.2s"></i></div></div>`;
    row.querySelector('.toggle').onclick=()=>{ if(on) enabled.delete(t.id); else enabled.add(t.id); renderTools(); };
    row.onclick=(e)=>{ if(e.target.closest('.toggle')) return; dispatchTool(t.id,{query:'demo '+t.label}); };
    toolsListEl.appendChild(row);
  });
}
function pushAnswer(role, html){
  const d=document.createElement('div'); d.className=`bubble ${role}`;
  d.innerHTML=html;
  answerCanvas.appendChild(d); answerCanvas.scrollTop=answerCanvas.scrollHeight;
  // thread count
  threadCount.textContent = answerCanvas.children.length + ' messages';
}
function pushThread(title, desc){
  const el=document.createElement('div'); el.className='thread-item';
  el.innerHTML=`<div class="t">${title}</div><div class="d">${desc}</div>`;
  threadList.prepend(el);
}
function addSource(title, meta, ok){ const el=document.createElement('div'); el.className='source';
  el.innerHTML=`<div class="source-icon">●</div><div><div class="source-title">${title}</div><div class="source-meta">${meta}</div></div><span class="source-status ${ok?'ok':''}">${ok?'ok':'wait'}</span>`;
  sourcesList.prepend(el); sourceCount.textContent = sourcesList.children.length;
  const prov=document.createElement('span'); prov.className='prov'; prov.textContent=title; sourcesInline.appendChild(prov);
}
function updateVMView(){
  if(fuelPill) fuelPill.textContent=`FUEL ${vm.fuel}`;
  if(hashPill) hashPill.textContent=`HASH ${vm.transcript_hash.toString(16).padStart(4,'0').toUpperCase()}`;
  if(vmStateEl) vmStateEl.textContent=vm.halted?'HALT':vm.waiting?'WAIT':'RUNNING';
  if(vmBrief) vmBrief.textContent=`PC $${vm.regs.pc.toString(16).padStart(4,'0')} · fuel ${vm.fuel} · retired ${vm.retired}`;
  if(fuelMini) fuelMini.textContent=vm.fuel; if(hashMini) hashMini.textContent='0x'+vm.transcript_hash.toString(16).padStart(4,'0'); if(cyclesMini) cyclesMini.textContent=vm.cycles;
  if(pcLabel) pcLabel.textContent=`$${vm.regs.pc.toString(16).padStart(4,'0')}`; if(regsLabel) regsLabel.textContent=`A ${vm.regs.a} B ${vm.regs.b} C ${vm.regs.c} D ${vm.regs.d} PC $${vm.regs.pc.toString(16).padStart(4,'0')} SP $${vm.regs.sp.toString(16).padStart(4,'0')}`;
  if(statRetired) statRetired.textContent=vm.retired; if(statCoverage) statCoverage.textContent=Math.min(100, Math.floor((trace.filter(t=>t.evidence).length/Math.max(1,trace.length))*100))+'%';
  if(memoryEl){ memoryEl.innerHTML=''; [['$00',vm.phase],['$01',vm.fuel],['$02',vm.regs.a>>8&0xff],['$03',vm.waiting?1:0],['$46 TLV',0x46],['$C6 CRC',0xC6]].forEach(([a,v])=>{const c=document.createElement('div');c.style.cssText='padding:4px;border-radius:6px;background:rgba(0,0,0,.25);border:1px solid var(--line2);text-align:center';c.innerHTML=`<div style="font-size:7.5px;color:var(--dim)">${a}</div><div style="font-size:9px" class="mono">0x${Number(v).toString(16).padStart(2,'0')}</div>`;memoryEl.appendChild(c)})}
  // sandbox dot
  if(sandboxDot) sandboxDot.className= pyReady?'dot ok':'dot warn';
  if(sandboxLabel) sandboxLabel.textContent= pyReady?'READY':'LOADING';
}
function encodeTLV(obj){ const j=JSON.stringify(obj); const b=new TextEncoder().encode(j); return {json:j, len:b.length, source_hash:phash(j), crc16:crc16(b)}}
function crc16(b){let c=0xFFFF; for(let x of b){c^=x<<8; for(let i=0;i<8;i++)c=(c&0x8000)?(c<<1)^0x1021:c<<1; c&=0xFFFF} return c}
function phash(s){let h=0; for(let i=0;i<s.length;i++)h=Math.imul(31,h)+s.charCodeAt(i)|0; return (h>>>0).toString(16).padStart(8,'0')}
function addTrace({pc,op,cap,result,fuel,hash,ok}){
  vm.trace_seq++; vm.retired++; vm.cycles += op==='RQ'?4:op==='VERIFY'?6:2; vm.transcript_hash=(vm.transcript_hash ^ hash)&0xFFFF; if(vm.fuel>0) vm.fuel--; if(vm.fuel===0) vm.halted=true; vm.regs.pc=(pc+1)&0xFFFF;
  const row={seq:vm.trace_seq, pc, op, cap, result:result?.slice(0,64)??'', fuel:vm.fuel, hash:hash.toString(16).padStart(4,'0'), ok, evidence:op==='EVIDENCE'};
  trace.unshift(row); if(trace.length>200) trace.pop(); renderTrace(); updateVMView(); if(liveWS?.readyState===1) liveWS.send(JSON.stringify({event:'retired',trace:row}));
}
function renderTrace(){ if(!traceBody) return; traceBody.innerHTML=''; trace.forEach(r=>{const tr=document.createElement('tr'); tr.innerHTML=`<td class="mono">#${r.seq}</td><td>${r.op}</td><td class="mono">${r.cap||'—'}</td><td class="mono">${r.fuel}</td>`; traceBody.appendChild(tr)}) }
function makeInstruction({capability,args,fuel=8}){ const id=Math.random().toString(36).slice(2,9).toUpperCase(); return {instruction_id:id, agent:agentSel?.value||'research', op:'tool_call', capability, arguments:args, expected:'evidence', fuel, transcript_hash:vm.transcript_hash}}
function mockBrokerResult(cap,args){ const q=args.query||args.q||args.word||'sovereign'; if(cap==='search'||cap==='tavily.search') return {results:[{title:`Tavily: ${q}`,url:`https://tavily.com/search?q=${encodeURIComponent(q)}`,content:`POST api.tavily.com/search advanced max_results=5 for ${q}`,score:0.92,source_hash:phash(q)}]}; if(cap==='wikipedia') return {results:[{title:`Wikipedia: ${q}`,url:`https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`,content:`w/api.php extracts ${q}`,score:0.88,source_hash:phash(q)}]}; if(cap==='dictionary') return {results:[{word:q,phonetic:`/${q}/`}]}; if(cap==='mathematica') return {results:[{title:`Wolfram ${q}`,content:`WolframAlpha ${q}`}]};
  if(cap==='fetch') return {results:[{title:`Fetch ${args.url||q}`,url:args.url||'https://example.com',content:`fetched ${args.url||q}`,score:0.9}]}; return {results:[{title:cap,url:`${cap}://`,content:JSON.stringify(args).slice(0,200),score:1.0,source_hash:phash(JSON.stringify(args))}]} }

// MACROGROK
function macrogrokInfer4(input){ let acc=0; for(let i=0;i<4;i++){ const q=Math.round((input[i]||0)*16384); acc += (q*[2458,-1638,819,3277][i])/16384 } let q324=acc/16, q312=q324/4096, score=Math.max(-2,Math.min(1.999,q312-256/4096)); const thr=score>=1?1:score<=-1?-1:score; const prev=parseFloat(localStorage.getItem('mg_state')||'0'); const nxt=(3*prev+thr)/4; localStorage.setItem('mg_state',String(nxt)); const flags=(Math.abs(score)>1.9?2:0)|(score>0?4:0)|1; return {input, acc:Math.round(acc), score:+score.toFixed(4), output:+nxt.toFixed(4), flags:'0b'+flags.toString(2).padStart(3,'0')} }
window.demoMacrogrok=()=> dispatchTool('macrogrok.infer4',{input:[0.5,-0.2,0.8,0.1]});
window.demoSearch=()=> dispatchTool('search',{query:'attention WMMA 16x16x16'});
window.demoPython=()=> dispatchABI({op:'python',code:'import numpy as np; np.arange(5)'});

// Capability Router
let pendingConfirm=null;
function routeOK(cap){ const t=TOOLS.find(x=>x.id===cap||x.label===cap); if(!t?.sensitive) return true; if(pendingConfirm?.exp>Date.now()){ pendingConfirm=null; return true } return false }

// JIT Box execute (single entry)
async function executeABI(op){
  // VALIDATE
  if(!op||!op.op) throw new Error('ABI: missing op');
  // EXECUTE
  if(op.op==='python'){
    const code=op.code||''; if(codeArea) codeArea.value=code; updateGutter();
    const res=await runPythonTool('python.execute',{code}); const tlv=encodeTLV(res);
    addTrace({pc:vm.regs.pc,op:'RQ',cap:'python',result:code.slice(0,32),fuel:vm.fuel,hash:0x20,ok:true});
    addTrace({pc:vm.regs.pc,op:'VERIFY',cap:'python',result:`TLV ${tlv.len} CRC ${tlv.crc16.toString(16)}`,fuel:vm.fuel,hash:tlv.crc16&0xFFFF,ok:true});
    addTrace({pc:vm.regs.pc,op:'EVIDENCE',cap:'python',result:tlv.json.slice(0,48),fuel:vm.fuel,hash:parseInt(tlv.source_hash.slice(0,4),16),ok:true});
    termStatus.textContent='ok'; appendTerm(code,''); if(res.stdout) appendTerm(res.stdout,'ok'); appendTerm(String(res.result??res.error), res.error?'err':'ok');
    artifacts.push({name:'result.json', content:tlv.json}); renderArtifacts(); addSource('python.execute','WASM Box',true);
    return {instruction:op, result:res.result, stdout:res.stdout||'', stderr:res.error||'', artifacts:artifacts.slice(-3), vm_state:snapshot()};
  }
  if(op.op==='tool'){
    const name=op.name||op.capability||'search', args=op.args||{}; if(!routeOK(name)){ addTrace({pc:vm.regs.pc,op:'CONFIRM',cap:name,result:'CONFIRM required',fuel:vm.fuel,hash:0x2A,ok:false}); throw new Error('CONFIRM required for '+name+' (0x2A) — call confirmCap()');}
    addTrace({pc:vm.regs.pc,op:'RQ',cap:name,result:JSON.stringify(args).slice(0,32),fuel:vm.fuel,hash:name.charCodeAt(0)||0x20,ok:true});
    await new Promise(r=>setTimeout(r,300));
    const mock=mockBrokerResult(name,args); const tlv=encodeTLV(mock);
    addTrace({pc:vm.regs.pc,op:'VERIFY',cap:name,result:`CRC 0x${tlv.crc16.toString(16)}`,fuel:vm.fuel,hash:tlv.crc16&0xFFFF,ok:true});
    addTrace({pc:vm.regs.pc,op:'EVIDENCE',cap:name,result:(mock.results?.[0]?.title||'').slice(0,32),fuel:vm.fuel,hash:parseInt(tlv.source_hash.slice(0,4),16),ok:true});
    addSource(name, JSON.stringify(args).slice(0,40), true);
    return {instruction:op, result:mock, stdout:'', stderr:'', artifacts:[], vm_state:snapshot()};
  }
  if(op.op==='vm'){
    const instr=op.instruction||op.code||'nop'; addTrace({pc:vm.regs.pc,op:'LDI',cap:'vm',result:instr.slice(0,24),fuel:vm.fuel,hash:phash(instr).slice(0,4)|0,ok:true});
    return {instruction:op, result:`vm: ${instr}`, stdout:'', stderr:'', artifacts:[], vm_state:snapshot()};
  }
  if(op.op==='final'){ return {instruction:op, result:op.content, stdout:'', stderr:'', artifacts, vm_state:snapshot()} }
  throw new Error('ABI: unknown op '+op.op);
}
function snapshot(){ return {pc:vm.regs.pc, fuel:vm.fuel, hash:vm.transcript_hash, retired:vm.retired, cycles:vm.cycles, regs:{...vm.regs}} }
function renderArtifacts(){ if(!artifactsEl) return; artifactsEl.innerHTML=''; artifacts.slice(-4).forEach(a=>{const d=document.createElement('div');d.className='artifact';d.innerHTML=`<b>${a.name}</b> ${String(a.content).slice(0,32)}`;artifactsEl.appendChild(d)}); if(filesList) filesList.textContent=artifacts.map(a=>a.name+': '+String(a.content).slice(0,80)).join('\n')||'No artifacts yet.' }
function updateGutter(){ if(!gutter||!codeArea) return; const n=codeArea.value.split('\n').length; gutter.innerHTML=Array.from({length:Math.max(8,n)},(_,i)=>String(i+1).padStart(2,'0')).join('<br>') }
if(codeArea) codeArea.addEventListener('input', updateGutter);

// Pyodide
async function initPy(){
  try{ pyodide=await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'}); await pyodide.loadPackage(['numpy','micropip']);
    pyodide.registerJsModule('tools',{search:(q)=>JSON.stringify(mockBrokerResult('search',{query:q})), fetch:(u)=>JSON.stringify(mockBrokerResult('fetch',{url:u})), wikipedia:(q)=>JSON.stringify(mockBrokerResult('wikipedia',{query:q})), dictionary:(w)=>JSON.stringify(mockBrokerResult('dictionary',{word:w})), macrogrok:(a)=>JSON.stringify(macrogrokInfer4(a))});
    pyReady=true; pyState.textContent='READY'; pyDot.className='dot ok'; appendTerm('Pyodide '+pyodide.version+' ready — WebLLM will drive python via ABI','ok'); updateVMView();
  }catch(e){ pyState.textContent='OFFLINE'; pyDot.className='dot off'; appendTerm('Pyodide failed: '+e.message,'err')}
}
async function runPythonTool(cap,args){
  if(!pyReady) return {error:'pyodide not ready',cap,args};
  const code=args.code||args.input||'';
  try{ await pyodide.runPythonAsync(`import sys,io; _buf=io.StringIO(); _old=sys.stdout; sys.stdout=_buf`);
    const res=await pyodide.runPythonAsync(code); const out=await pyodide.runPythonAsync(`_buf.getvalue(); sys.stdout=_old; _buf.getvalue()`); return {code, result:String(res), stdout:String(out||''), cap}
  }catch(e){ return {code, error:String(e), cap} }
}
function appendTerm(t,cls){ if(!termOut) return; const d=document.createElement('div'); d.textContent=t; d.style.color=cls==='err'?'var(--err)':cls==='ok'?'var(--muted)':'#cbd5e1'; termOut.appendChild(d); termOut.scrollTop=termOut.scrollHeight; if(termStatus) termStatus.textContent=cls||'ok'}
window.runTerm=async()=>{ const c=termIn.value.trim(); if(!c) return; termIn.value=''; appendTerm('>>> '+c,''); const r=await runPythonTool('python.execute',{code:c}); if(r.stdout) appendTerm(r.stdout,'ok'); appendTerm(String(r.result??r.error), r.error?'err':'ok')};
window.runSandbox=()=>{ const c=codeArea.value; dispatchABI({op:'python',code:c})};
window.resetSandbox=async()=>{ if(pyodide) await pyodide.runPythonAsync(`import sys; sys.modules.clear()`); artifacts=[]; renderArtifacts(); appendTerm('kernel reset','ok')};
window.switchTab=(t)=>{ document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active', el.dataset.tab===t));
  const map={python:['pane-python','pane-terminal'], files:['pane-files'], vm:['pane-vm'], tools:['pane-tools'], terminal:['pane-terminal']};
  ['pane-python','pane-terminal','pane-files','pane-vm','pane-tools'].forEach(id=>{const el=document.getElementById(id); if(el) el.style.display='none'});
  let show = t==='python'?['pane-python','pane-terminal']: t==='terminal'?['pane-terminal'] : [ 'pane-'+t];
  show.forEach(id=>{const el=document.getElementById(id); if(el) el.style.display='' occasion:el.style.display='flex'});
  if(t==='python'){ document.getElementById('pane-python').style.display='flex'; document.getElementById('pane-terminal').style.display='flex' }
}

// ABI helpers
async function dispatchABI(op){ currentTaskEl.textContent= JSON.stringify(op).slice(0,80); answerStatus.textContent=op.op; try{ const res=await executeABI(op); pushAnswer('agent', `<div class="mono" style="font-size:9px;color:var(--dim)">ABI ${op.op}</div><pre style="margin-top:6px;padding:8px;background:rgba(0,0,0,.25);border-radius:8px;overflow:auto;font-size:10px">${JSON.stringify(res,null,2).slice(0,1200)}</pre>`); return res }catch(e){ pushAnswer('agent', `<span style="color:var(--err)">${e.message}</span>`); return {instruction:op, result:null, stdout:'', stderr:String(e), artifacts:[], vm_state:snapshot()} } }
async function dispatchTool(cap,args){ return dispatchABI(cap.startsWith('python')?{op:'python',code:args.code||args.query||''}:{op:'tool',name:cap,args}) }
window.dispatchTool=dispatchTool; window.dispatchABI=dispatchABI; window.macrogrokInfer4=macrogrokInfer4;

// WebLLM — Worker
function createWorker(){
  const code=`
import {CreateMLCEngine} from "https://esm.run/@mlc-ai/web-llm@0.2.79";
let engine=null;
self.onmessage = async (e)=>{
  const d=e.data;
  if(d.type==='load'){
    try{
      engine = await CreateMLCEngine(d.model, {initProgressCallback:(p)=> self.postMessage({type:'progress', text:p.text, progress:p.progress})});
      self.postMessage({type:'ready', model:d.model});
    }catch(err){ self.postMessage({type:'error', error:String(err)}) }
  }
  if(d.type==='generate'){
    try{
      const r = await engine.chat.completions.create({messages:d.messages, temperature: d.temperature??0.2, max_tokens: d.max_tokens??512});
      self.postMessage({type:'reply', id:d.id, content: r.choices[0].message.content});
    }catch(err){ self.postMessage({type:'error', error:String(err), id:d.id}) }
  }
};
`;
  const blob=new Blob([code],{type:'text/javascript'});
  return new Worker(URL.createObjectURL(blob),{type:'module'});
}
async function initWebLLM(){
  if(webllmLoading||webllmReady) return; webllmLoading=true; modelStateEl.textContent='LOADING'; modelDot.className='dot warn'; modelName.textContent=webllmModel; answerStatus.textContent='loading webllm';
  try{
    if(typeof Worker==='undefined') throw new Error('Worker unsupported');
    webllmWorker=createWorker();
    webllmWorker.onmessage=(e)=>{
      const d=e.data;
      if(d.type==='progress'){ modelStateEl.textContent=d.text.slice(0,40); modelDot.className='dot warn'; }
      if(d.type==='ready'){ webllmReady=true; webllmLoading=false; modelStateEl.textContent='READY'; modelDot.className='dot ok'; answerStatus.textContent='webllm ready'; pushAnswer('agent', `<span style="color:var(--ok)">WebLLM ready</span> <span class="mono">${d.model}</span> — will emit <code>python/tool/vm/final</code> ABI → JIT Box.`); }
      if(d.type==='reply'){ const cb=webllmPending.get(d.id); if(cb) cb(d.content); }
      if(d.type==='error'){ webllmLoading=false; modelStateEl.textContent='ERROR'; modelDot.className='dot off'; pushAnswer('agent', `<span style="color:var(--err)">WebLLM error:</span> ${d.error}`); }
    };
    webllmWorker.postMessage({type:'load', model:webllmModel});
  }catch(e){
    webllmLoading=false; modelStateEl.textContent='OFFLINE'; modelDot.className='dot off';
    pushAnswer('agent', `WebLLM unavailable (${e.message}) — fallback planner active.`);
  }
}
let webllmPending=new Map(), webllmId=0;
function webllmGenerate(messages){
  return new Promise((resolve,reject)=>{
    const id=++webllmId; webllmPending.set(id, resolve);
    webllmWorker.postMessage({type:'generate', id, messages, temperature:0.2});
    setTimeout(()=>{ if(webllmPending.has(id)){ webllmPending.delete(id); reject(new Error('webllm timeout')) }}, 30000);
  });
}
function parseABI(text){
  // extract first JSON object with op
  const m=text.match(/\{[\s\S]*?"op"\s*:\s*"(python|tool|vm|final)"[\s\S]*?\}/);
  if(!m) return [];
  try{ return [JSON.parse(m[0])] }catch{ return []}
}

// Single execution loop: MODEL→PARSE→VALIDATE→JIT→RESULT→MODEL
async function runLoop(userPrompt){
  pushAnswer('user', userPrompt.replace(/</g,'&lt;'));
  pushThread(userPrompt.slice(0,40), 'WebLLM → JIT');
  threadCount.textContent = (threadList.children.length)+' threads';
  currentTaskEl.textContent = userPrompt.slice(0,100);
  answerStatus.textContent = webllmReady?'webllm thinking':'planning';
  if(!webllmReady){
    // fallback: planner is the loop (two steps) — no artificial layer, just deterministic
    const s=await dispatchABI({op:'tool', name:'tavily.search', args:{query:userPrompt.slice(0,60)}});
    const p=await dispatchABI({op:'python', code:`q=\"\"\"${userPrompt.slice(0,60).replace(/"/g,'\\"')}\"\"\"; len(q)`});
    const final=`**Answer** for "${userPrompt.slice(0,60)}" — Tavily: ${String(s.result).slice(0,120)} · Python: ${String(p.result).slice(0,80)} (fused via WASM Box, VM fuel ${vm.fuel})`;
    pushAnswer('agent', `<div style="line-height:1.6">${final.replace(/</g,'&lt;')}</div>`); answerStatus.textContent='final (fallback)'; return;
  }
  // WebLLM is the instruct model
  let history=[{role:'system', content:ABI_SYSTEM}, {role:'user', content:userPrompt}];
  for(let step=0; step<8 && vm.fuel>0; step++){
    answerStatus.textContent=`webllm step ${step+1}/8`;
    let reply;
    try{ reply=await webllmGenerate(history) }catch(e){ pushAnswer('agent', `<span style="color:var(--err)">WebLLM generate failed:</span> ${e.message}`); break; }
    const ops=parseABI(reply);
    if(!ops.length){ pushAnswer('agent', `<div class="mono" style="font-size:9px">model raw:</div><pre style="font-size:10px;white-space:pre-wrap">${reply.slice(0,800).replace(/</g,'&lt;')}</pre>`); break; }
    const op=ops[0];
    history.push({role:'assistant', content:JSON.stringify(op)});
    if(op.op==='final'){ pushAnswer('agent', `<div style="line-height:1.6">${String(op.content).replace(/</g,'&lt;').replace(/\n/g,'<br>')}</div>`); answerStatus.textContent='final'; break; }
    const res=await dispatchABI(op);
    // Give model the box state
    history.push({role:'user', content:JSON.stringify({instruction:op, result:res.result, stdout:res.stdout, stderr:res.stderr, artifacts:res.artifacts, vm_state:res.vm_state}).slice(0,4000)});
    if(vm.halted){ pushAnswer('agent', `<span style="color:var(--err)">FUEL trap — halted</span>`); break; }
  }
}

// Ask bar
function handleAsk(){
  const t=askInput.value.trim(); if(!t) return; askInput.value=''; runLoop(t);
}
document.getElementById('btnSend').onclick=handleAsk;
askInput.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); handleAsk()} });
document.getElementById('btnModel').onclick=initWebLLM;
if(termIn) termIn.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); runTerm()}});
window.newThread=()=>{ answerCanvas.innerHTML=''; sourcesInline.innerHTML=''; threadList.querySelectorAll('.thread-item').forEach(el=>el.classList.remove('active')) };
window.clearAnswer=()=>{ answerCanvas.innerHTML=''; };
window.clearTrace=()=>{ trace=[]; renderTrace(); vm.retired=0; updateVMView()};
window.exportTrace=()=>{ const b=new Blob([JSON.stringify(trace,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`trace-${Date.now()}.json`; a.click()};

// boot
renderTools(); updateVMView(); updateGutter(); renderArtifacts();
appendTerm('WASM Box: WebLLM will drive python via ABI {"op":"python","code":"..."} → JIT Box (isolated, tools mediated).','ok');
appendTerm('Ask anything below — or Load WebLLM first for local instruct model (Phi-3-mini).','ok');
initPy();
try{ const proto=location.protocol==='https:'?'wss:':'ws:'; const ws=new WebSocket(proto+location.hostname+':4000/socket/websocket'); ws.onopen=()=>{liveWS=ws; pushAnswer('agent','<span style="color:var(--ok)">LiveView WS connected</span> — TraceHub PubSub');}; ws.onerror=()=>{} }catch{}
window.vm=vm; window.TOOLS=TOOLS;
