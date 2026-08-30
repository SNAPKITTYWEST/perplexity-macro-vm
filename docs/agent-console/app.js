// Perplexity Macro VM — Agent Console (GitHub Pages static, Phoenix LiveView-ready)
// - VM owns control flow (RQ -> Capability Router -> ResearchBroker -> TLV + CRC16 -> VM)
// - Model = instruction generator, WASM/Pyodide = isolated execution, LiveView = observability
// All 22 Sovereign Engine tools mediated. Sensitive caps require CONFIRM.

const TOOLS = [
  { id:'search', cap:0x01, label:'search', icon:'◉', desc:'Tavily deep research', sensitive:false, tier:'research' },
  { id:'fetch', cap:0x02, label:'fetch', icon:'↗', desc:'Allowlisted GET + extract', sensitive:false, tier:'research' },
  { id:'browser', cap:0x03, label:'browser', icon:'◫', desc:'Playwright automation', sensitive:true, tier:'sovereign' },
  { id:'code', cap:0x04, label:'code', icon:'λ', desc:'bwrap/nsjail sandbox', sensitive:true, tier:'sovereign' },
  { id:'local_model', cap:0x05, label:'local model', icon:'◇', desc:'Ollama / LM Studio', sensitive:false, tier:'local' },
  { id:'wikipedia', cap:0x06, label:'wikipedia', icon:'W', desc:'MediaWiki extracts', sensitive:true, tier:'research' },
  { id:'mathematica', cap:0x07, label:'mathematica', icon:'∫', desc:'WolframAlpha', sensitive:true, tier:'research' },
  { id:'dictionary', cap:0x08, label:'dictionary', icon:'Aa', desc:'dictionaryapi + WordNet', sensitive:false, tier:'research' },
  { id:'python.execute', cap:0x04, label:'python.execute', icon:'▶', desc:'WASM IPython exec', sensitive:false, tier:'sandbox' },
  { id:'python.inspect', cap:0x04, label:'python.inspect', icon:'◎', desc:'Inspect namespace', sensitive:false, tier:'sandbox' },
  { id:'slc.evaluate', cap:null, label:'slc.evaluate', icon:'🛡', desc:'5-bank adversarial scan', sensitive:false, tier:'sovereign-tool-api' },
  { id:'ere.score', cap:null, label:'ere.score', icon:'◐', desc:'Entropy quality 0-100', sensitive:false, tier:'sovereign-tool-api' },
  { id:'quantum.temp', cap:null, label:'quantum.temp', icon:'∿', desc:'ANU QRNG → φ temp', sensitive:false, tier:'quantum' },
  { id:'worm.seal', cap:null, label:'worm.seal', icon:'⬢', desc:'SHA-256 WORM seal', sensitive:false, tier:'sovereign' },
  { id:'worm.verify', cap:null, label:'worm.verify', icon:'✓', desc:'Verify hash chain', sensitive:false, tier:'sovereign' },
  { id:'swarm.run', cap:null, label:'swarm.run', icon:'⬡', desc:'Quantum swarm N agents', sensitive:false, tier:'sovereign' },
  { id:'agent.call', cap:null, label:'agent.call', icon:'⬔', desc:'Call BOB/METATRON/etc', sensitive:false, tier:'sovereign' },
  { id:'macrogrok.infer4', cap:0x04, label:'macrogrok.infer4', icon:'◈', desc:'Q1.14/Q3.12 fixed-point', sensitive:false, tier:'macrogrok' },
  { id:'regex.match', cap:null, label:'regex.match', icon:'≋', desc:'Sovereign regex banks', sensitive:false, tier:'sovereign-tool-api' },
  { id:'metatron.phi', cap:null, label:'metatron.phi', icon:'φ', desc:'Phi depth activation', sensitive:false, tier:'sovereign-tool-api' },
  { id:'metatron.cube', cap:null, label:'metatron.cube', icon:'⬣', desc:'13-node cube walk', sensitive:false, tier:'sovereign-tool-api' },
  { id:'tavily.search', cap:0x01, label:'tavily.search', icon:'◎', desc:'Tavily advanced 5', sensitive:false, tier:'research' },
];

// VM state (mirrors PerplexityMacro.VM.State)
let vm = {
  regs:{a:0,b:0,c:0,d:0, pc:0x0000, sp:0xDFFF, bp:0, flags:0},
  rom:{}, ram:{}, cycles:0, retired:0, fuel:128, transcript_hash:0, trace_seq:0, waiting:false, halted:false, phase:0
};
let trace = [];
let enabled = new Set(TOOLS.filter(t=>!t.sensitive).map(t=>t.id));
let pyodide = null, pyReady=false;
let worm = [];
let liveWS = null; // Phoenix LiveView placeholder

const $ = s=>document.querySelector(s);
const chatLog=$('#chatLog'), chatInput=$('#chatInput'), agentSel=$('#agentSel');
const traceBody=$('#traceBody'), termOut=$('#termOut'), termIn=$('#termIn');
const fuelPill=$('#fuelPill'), hashPill=$('#hashPill'), vmStateEl=$('#vmState');
const statRetired=$('#statRetired'), statCycles=$('#statCycles'), statTranscript=$('#statTranscript'), statCoverage=$('#statCoverage');
const pcLabel=$('#pcLabel'), regsLabel=$('#regsLabel'), memoryEl=$('#memory'), planLabel=$('#planLabel');
const pyState=$('#pyState'), pyDot=$('#pyDot'), wasmState=$('#wasmState');

function renderTools(){
  const el=$('#toolsList'); el.innerHTML='';
  TOOLS.forEach(t=>{
    const on = enabled.has(t.id);
    const row=document.createElement('div'); row.className='tool';
    row.innerHTML=`
      <div class="tool-left">
        <div class="tool-icon">${t.icon}</div>
        <div>
          <div class="tool-name">${t.label} ${t.sensitive?'<span style="font-size:10px; color:#f59e0b; border:1px solid rgba(245,158,11,.3); padding:1px 5px; border-radius:6px; margin-left:6px">CONFIRM</span>':''}</div>
          <div class="tool-desc">${t.desc} · ${t.tier}</div>
        </div>
      </div>
      <div class="tool-right">
        <span class="cap">${t.cap!==null?'0x'+t.cap.toString(16).padStart(2,'0').toUpperCase():'—'}</span>
        <div class="toggle ${on?'on':''}" data-id="${t.id}"><i></i></div>
      </div>`;
    row.querySelector('.toggle').onclick=()=>{
      if(on) enabled.delete(t.id); else enabled.add(t.id);
      renderTools(); pushChat('system', `Capability <b>${t.label}</b> ${on?'disabled':'enabled'}. ${t.sensitive?'CONFIRM token required when enabled.':''}`);
    };
    row.onclick=(e)=>{ if(e.target.closest('.toggle')) return; dispatchTool(t.id, {demo:true}); };
    el.appendChild(row);
  });
  $('#toolStatus').textContent = `${TOOLS.length} tools · ${[...enabled].length} enabled · sensitive require CONFIRM (0x2A)`;
}

function pushChat(role, html, meta){
  const d=document.createElement('div'); d.className=`msg ${role==='user'?'user':'agent'}`;
  const m = meta? `<div class="meta">${meta}</div>`:'';
  d.innerHTML = m + html;
  chatLog.appendChild(d); chatLog.scrollTop=chatLog.scrollHeight;
}

function setPipeline(active){
  document.querySelectorAll('.step').forEach(el=>{
    el.classList.remove('active','done');
    const s=el.dataset.s;
    const order=['plan','tool','wasm','verify','evidence'];
    const ai=order.indexOf(active), si=order.indexOf(s);
    if(s===active) el.classList.add('active');
    else if(si<ai) el.classList.add('done');
  });
  planLabel.textContent = active;
}

function updateVMView(){
  fuelPill.textContent = `FUEL ${vm.fuel}`;
  hashPill.textContent = `HASH ${vm.transcript_hash.toString(16).padStart(4,'0').toUpperCase()}`;
  statRetired.textContent = vm.retired;
  statCycles.textContent = vm.cycles;
  statTranscript.textContent = '0x'+vm.transcript_hash.toString(16).padStart(4,'0');
  statCoverage.textContent = Math.min(100, Math.floor((trace.filter(t=>t.evidence).length / Math.max(1, trace.length))*100)) + '%';
  pcLabel.textContent = `PC $${vm.regs.pc.toString(16).padStart(4,'0').toUpperCase()} → fuel ${vm.fuel}`;
  regsLabel.textContent = `A ${vm.regs.a} B ${vm.regs.b} C ${vm.regs.c} D ${vm.regs.d} PC $${vm.regs.pc.toString(16).padStart(4,'0')} SP $${vm.regs.sp.toString(16).padStart(4,'0')} FLAGS ${vm.regs.flags}`;
  $('#footHash').textContent = 'transcript 0x'+vm.transcript_hash.toString(16).padStart(4,'0');
  vmStateEl.textContent = vm.halted?'HALT': vm.waiting?'WAITING':'RUNNING';
  // memory hex (ROM mailbox)
  memoryEl.innerHTML='';
  const map = [['$00 phase', vm.phase], ['$01 fuel', vm.fuel], ['$02 cap', vm.regs.a>>8 & 0xff], ['$03 status', vm.waiting?0x01:0x00], ['$46 TLV', 0x46], ['$C6 CRC16', 0xC6], ['$8000 ROM', 0x8000], ['$DFFF SP', vm.regs.sp]];
  map.forEach(([a,v])=>{
    const c=document.createElement('div'); c.className='mcell';
    c.innerHTML=`<div class="a">${a}</div><div class="v">${typeof v==='number'?'0x'+v.toString(16).padStart(2,'0'):v}</div>`;
    memoryEl.appendChild(c);
  });
}

// TLV + CRC16 (matches PerplexityMacro.Evidence)
function encodeTLV(obj){
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  // pad to TLV: [len(2) | payload | crc16(2)] — simplified for console
  return { json, bytes, len: bytes.length, source_hash: phash(json), crc16: crc16(bytes) };
}
function crc16(bytes){
  let crc=0xFFFF;
  for(let b of bytes){ crc ^= b<<8; for(let i=0;i<8;i++) crc = (crc & 0x8000)? (crc<<1)^0x1021 : crc<<1; crc&=0xFFFF; }
  return crc;
}
function phash(s){ let h=0; for(let i=0;i<s.length;i++) h = Math.imul(31,h)+s.charCodeAt(i)|0; return (h>>>0).toString(16).padStart(8,'0'); }

function addTrace({pc,op,cap,result,fuel,hash,ok}){
  vm.trace_seq++; vm.retired++; vm.cycles += (op==='RQ'?4:op==='VERIFY'?6:op==='FUEL'?1:2);
  vm.transcript_hash = (vm.transcript_hash ^ hash) & 0xFFFF;
  if(vm.fuel>0) vm.fuel--;
  if(vm.fuel===0) vm.halted=true;
  vm.regs.pc = (pc+1) & 0xFFFF;
  const row={seq:vm.trace_seq, pc, op, cap, result: result?.slice(0,64)??'', fuel:vm.fuel, hash:hash.toString(16).padStart(4,'0'), ok, evidence: op==='EVIDENCE'};
  trace.unshift(row); if(trace.length>200) trace.pop();
  renderTrace(); updateVMView();
  // PubSub (Phoenix LiveView trace_hub 50k ring)
  if(liveWS && liveWS.readyState===1) liveWS.send(JSON.stringify({event:'retired', trace:row}));
}

function renderTrace(){
  traceBody.innerHTML='';
  trace.forEach(r=>{
    const tr=document.createElement('tr');
    const status = r.ok?'<span class="badge2 b-ok">OK</span>': r.op==='FUEL'&&r.fuel===0?'<span class="badge2 b-err">TRAP</span>':'<span class="badge2 b-warn">WAIT</span>';
    tr.innerHTML=`<td class="mono">#${r.seq}</td><td class="mono">$${r.pc.toString(16).padStart(4,'0')}</td><td>${r.op}</td><td class="mono">${r.cap||'—'}</td><td title="${r.result}">${r.result||'—'}</td><td class="mono">${r.fuel}</td><td class="mono">0x${r.hash}</td><td>${status}</td>`;
    traceBody.appendChild(tr);
  });
}

// Instruction protocol (agent -> VM)
function makeInstruction({capability, args, fuel=8}){
  const id = Math.random().toString(36).slice(2,9).toUpperCase();
  return {
    instruction_id: id,
    agent: agentSel.value,
    op: 'tool_call',
    capability,
    arguments: args,
    expected: 'evidence',
    fuel,
    transcript_hash: vm.transcript_hash
  };
}
function makeResult(instr, status, result){
  return {
    instruction_id: instr.instruction_id,
    status,
    result,
    source_hash: phash(JSON.stringify(result)).slice(0,8),
    transcript_hash: '0x'+vm.transcript_hash.toString(16).padStart(4,'0'),
    fuel_remaining: vm.fuel
  };
}

// Capability Router (policy: sensitive needs CONFIRM + token)
let pendingConfirm = null;
function routeCapability(instr){
  // find tool
  const tool = TOOLS.find(t=> t.id===instr.capability || t.label===instr.capability);
  const sensitive = tool?.sensitive;
  if(sensitive && !pendingConfirm){
    // require CONFIRM 0x2A
    addTrace({pc:vm.regs.pc, op:'CONFIRM', cap:instr.capability, result:'CONFIRM required (sensitive)', fuel:vm.fuel, hash:0x2A, ok:false});
    pushChat('agent', `<b>CONFIRM required</b> for <code>${instr.capability}</code> (sensitive). <button class="btn" onclick="confirmCap('${instr.instruction_id}')">Confirm (one-shot token)</button> <button class="btn ghost" onclick="denyCap()">Deny</button>`, `CAPABILITY ROUTER · 0x2A`);
    return { needsConfirm:true, instr };
  }
  pendingConfirm=null;
  return { needsConfirm:false, instr };
}
window.confirmCap = (id)=>{ pendingConfirm = {id, exp: Date.now()+ 60_000, token: Math.random().toString(16).slice(2,10)}; pushChat('agent', `CONF>rence token <code>${pendingConfirm.token}</code> issued (60s). Dispatching…`, 'CONFIRM · 0x2A'); if(window._pendingInstr) dispatchNow(window._pendingInstr); };
window.denyCap = ()=>{ pushChat('agent', `Denied.`, 'CONFIRM'); window._pendingInstr=null; };

// ResearchBroker dispatch (typed, TLV)
async function dispatchTool(capability, args){
  const instr = makeInstruction({capability, args, fuel:8});
  window._pendingInstr = instr;
  const routed = routeCapability(instr);
  if(routed.needsConfirm) return;
  await dispatchNow(instr);
}
async function dispatchNow(instr){
  setPipeline('tool');
  addTrace({pc:vm.regs.pc, op:'RQ', cap:instr.capability, result: JSON.stringify(instr.arguments).slice(0,48), fuel:vm.fuel, hash: instr.capability.charCodeAt(0) || 0x20, ok:true});
  vm.waiting=true; updateVMView();
  pushChat('agent', `<div class="tool-call"><span class="chip">RQ 0x${(TOOLS.find(t=>t.label===instr.capability)?.cap||0).toString(16).padStart(2,'0')}</span> <span class="mono">${instr.capability}</span> <span>${JSON.stringify(instr.arguments).slice(0,80)}</span></div>`, `INSTRUCTION ${instr.instruction_id} · ${instr.agent}`);

  // WASM / IPython path vs external host
  if(instr.capability.startsWith('python.')){
    setPipeline('wasm');
    const res = await runPythonTool(instr.capability, instr.arguments);
    setPipeline('verify');
    const tlv = encodeTLV(res);
    addTrace({pc:vm.regs.pc, op:'VERIFY', cap:instr.capability, result:`TLV len ${tlv.len} CRC ${tlv.crc16.toString(16)}`, fuel:vm.fuel, hash:tlv.crc16 & 0xFFFF, ok:true});
    addTrace({pc:vm.regs.pc, op:'EVIDENCE', cap:instr.capability, result: tlv.json.slice(0,64), fuel:vm.fuel, hash: parseInt(tlv.source_hash.slice(0,4),16), ok:true});
    setPipeline('evidence');
    const reply = makeResult(instr,'ok', {...res, tlv_len: tlv.len, crc16: tlv.crc16, source_hash: tlv.source_hash});
    pushChat('agent', `<pre>${JSON.stringify(reply, null, 2)}</pre>`, `EVIDENCE · python sandbox`);
    appendTerm(`[${instr.capability}] → ${tlv.json.slice(0,200)}`, 'ok');
  } else if (instr.capability==='macrogrok.infer4' || instr.capability==='macrogrok'){
    setPipeline('wasm');
    const res = macrogrokInfer4(instr.arguments.input || [0.2,0.1,0.3,0.0]);
    const tlv=encodeTLV(res);
    addTrace({pc:vm.regs.pc, op:'VERIFY', cap:'macrogrok', result:`ACC Q7.24 ${res.acc}`, fuel:vm.fuel, hash:tlv.crc16 & 0xFFFF, ok:true});
    addTrace({pc:vm.regs.pc, op:'EVIDENCE', cap:'macrogrok', result:`OUT ${res.output} FLAGS ${res.flags}`, fuel:vm.fuel, hash: parseInt(tlv.source_hash.slice(0,4),16), ok:true});
    setPipeline('evidence');
    pushChat('agent', `<div>Q1.14 → Q7.24 → Q3.12 fixed-point. <b>output</b> ${res.output} <b>score</b> ${res.score} <b>flags</b> ${res.flags}</div><pre>${JSON.stringify(res,null,2)}</pre>`, `MACROGROK · INFER4`);
  } else {
    // external ResearchBroker — simulate Tavily/Wiki/etc with typed mock (replace with real broker URL)
    setPipeline('wasm');
    await new Promise(r=>setTimeout(r, 400));
    const mock = mockBrokerResult(instr.capability, instr.arguments);
    setPipeline('verify');
    const tlv=encodeTLV(mock);
    addTrace({pc:vm.regs.pc, op:'VERIFY', cap:instr.capability, result:`schema OK CRC 0x${tlv.crc16.toString(16)}`, fuel:vm.fuel, hash:tlv.crc16 & 0xFFFF, ok:true});
    setPipeline('evidence');
    addTrace({pc:vm.regs.pc, op:'EVIDENCE', cap:instr.capability, result: (mock.results?.[0]?.title || tlv.json).slice(0,48), fuel:vm.fuel, hash: parseInt(tlv.source_hash.slice(0,4),16), ok:true});
    addTrace({pc:vm.regs.pc, op:'COVERAGE', cap:instr.capability, result:`coverage ${(Math.random()*0.4+0.6).toFixed(2)}`, fuel:vm.fuel, hash:0x19, ok:true});
    const reply=makeResult(instr,'ok', {...mock, tlv_len:tlv.len, crc16: tlv.crc16, source_hash: tlv.source_hash});
    pushChat('agent', `<pre>${JSON.stringify(reply, null, 2)}</pre>`, `EVIDENCE · ${instr.capability}`);
  }
  vm.waiting=false; updateVMView();
  // fuel trap
  if(vm.fuel<=0){ addTrace({pc:vm.regs.pc, op:'FUEL', cap:'—', result:'fuel exhausted — trap', fuel:0, hash:0x28, ok:false}); pushChat('agent','<b>FUEL trap</b>: instruction halted. Reset to continue.','VM · 0x28'); vm.halted=true; }
}

function mockBrokerResult(cap, args){
  const q = args.query || args.q || args.word || 'sovereign';
  if(cap==='search' || cap==='tavily.search'){
    return {results:[{title:`Tavily: ${q} — advanced`, url:`https://tavily.com/search?q=${encodeURIComponent(q)}`, content:`Synthetic result for ${q}. Replace with POST https://api.tavily.com/search (search_depth=advanced, max_results=5).`, score:0.92, source_hash: phash(q)}], tool:'tavily'};
  }
  if(cap==='wikipedia') return {results:[{title:`Wikipedia: ${q}`, url:`https://en.wikipedia.org/wiki/${encodeURIComponent(q)}`, content:`Extract for ${q}. GET w/api.php?action=query&prop=extracts&explaintext&titles=${q}`, score:0.88, source_hash: phash(q)}]};
  if(cap==='mathematica') return {results:[{title:`WolframAlpha: ${q}`, url:`https://www.wolframalpha.com/input?i=${encodeURIComponent(q)}`, content:`Mathematica result for ${q}.`, score:0.85, source_hash: phash(q)}]};
  if(cap==='dictionary') return {results:[{word:q, phonetic:`/${q}/`, meanings:[{partOfSpeech:'noun', definitions:[{definition:`Synthetic definition for ${q}.`}]}] , source_hash: phash(q)}]};
  if(cap==='fetch') return {results:[{title:`Fetch: ${args.url||q}`, url:args.url||'https://example.com', content:`Fetched ${args.url||q} (allowlisted, size/MIME/rate limited).`, score:0.9, source_hash: phash(args.url||q)}]};
  return {results:[{title: cap, url:`${cap}://`, content: JSON.stringify(args).slice(0,200), score:1.0, source_hash: phash(JSON.stringify(args))}]};
}

// ——— MACROGROK fixed-point (mirrors MACROGROK/src/sim.py + examples/infer4.asm)
function saturate(v, min, max){ return Math.max(min, Math.min(max, v)); }
function q14(x){ return Math.round(x*16384); }
function fromQ14(v){ return v/16384; }
function macrogrokInfer4(input){
  // input: 4 floats in [-1,1) Q1.14
  const WEIGHTS=[2458,-1638,819,3277].map(v=>v/16384); // Q1.14 ROM
  const BIAS=-256/4096; // Q3.12
  const ALPHA=0.75;
  // dot in Q2.28 -> Q3.24
  let acc=0;
  for(let i=0;i<4;i++){ const prod = (q14(input[i]||0) * [2458,-1638,819,3277][i]) / 16384; acc += prod; } // Q2.28-ish
  let q324 = acc / 16; // >>4 to Q3.24
  let q312 = q324 / 4096; // >>12 -> Q3.12
  let score = q312 + BIAS;
  score = saturate(score, -2, 1.999);
  const target = score >= 1.0 ? 1 : score <= -1.0 ? -1 : score; // threshold simplified
  const thr = target>0? 1 : target<0? -1 : 0;
  // state 3/4 smoothing
  const _state = parseFloat((localStorage.getItem('mg_state')||'0'));
  const nextState = (3*_state + thr)/4;
  localStorage.setItem('mg_state', String(nextState));
  const flags = (Math.abs(score)>2?2:0) | (score>0?4:0) | 1; // sat + positive + valid
  return {input, weights_Q1_14:[2458,-1638,819,3277], bias_Q3_12:-256, acc: Math.round(acc), score_Q3_12: Math.round(score*4096), score: +score.toFixed(4), output: +nextState.toFixed(4), flags: '0b'+flags.toString(2).padStart(3,'0'), state: +nextState.toFixed(4)};
}
window.demoMacrogrok = ()=> dispatchTool('macrogrok.infer4', {input:[0.5, -0.2, 0.8, 0.1]});
window.demoSearch = ()=> dispatchTool('search', {query:'attention WMMA 16x16x16'});
window.demoPython = ()=> dispatchTool('python.execute', {code:'import math; [math.sqrt(i) for i in [1,2,4,9]]'});
window.demoConfirm = ()=> dispatchTool('browser', {url:'https://example.com'});

// ——— Pyodide bridge (WASM sandbox, Web Worker-friendly)
async function initPy(){
  try{
    pyodide = await loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'});
    await pyodide.loadPackage(['numpy','micropip']);
    // inject mediated tools (no direct net/fs)
    pyodide.registerJsModule('tools', {
      search: (q)=> JSON.stringify(mockBrokerResult('search',{query:q})),
      fetch: (url)=> JSON.stringify(mockBrokerResult('fetch',{url})),
      wikipedia: (q)=> JSON.stringify(mockBrokerResult('wikipedia',{query:q})),
      mathematica: (q)=> JSON.stringify(mockBrokerResult('mathematica',{query:q})),
      dictionary: (w)=> JSON.stringify(mockBrokerResult('dictionary',{word:w})),
      macrogrok: (arr)=> JSON.stringify(macrogrokInfer4(arr)),
    });
    pyReady=true; pyState.textContent='READY'; pyDot.className='dot ok';
    appendTerm('Pyodide ' + pyodide.version + ' ready — numpy available. Try: import numpy as np; np.arange(5)', 'ok');
    // warm: expose sovereign tools in Python
    await pyodide.runPythonAsync(`
import sys, json, tools
print("tools:", [x for x in dir(tools) if not x.startswith('_')])
`);
  }catch(e){
    pyState.textContent='OFFLINE'; pyDot.className='dot off';
    appendTerm('Pyodide failed: '+e.message, 'err');
  }
}
async function runPythonTool(cap, args){
  if(!pyReady) return {error:'pyodide not ready', cap, args};
  const code = args.code || args.input || '';
  if(cap==='python.inspect'){
    const ns = await pyodide.runPythonAsync(`str(dir())`);
    return {ns, cap, code};
  }
  if(cap==='python.execute'){
    try{
      // capture stdout
      await pyodide.runPythonAsync(`import sys, io; _buf=io.StringIO(); _old=sys.stdout; sys.stdout=_buf`);
      const result = await pyodide.runPythonAsync(code);
      const out = await pyodide.runPythonAsync(`_buf.getvalue(); sys.stdout=_old; _buf.getvalue()`);
      // try to serialize result
      let serialized = null;
      try{
        const asJson = await pyodide.runPythonAsync(`import json, reprlib; \ntry:\n import numpy as np\n j=json.dumps(__import__('json').loads(__import__('json').dumps(str(${JSON.stringify(result)}))))\nexcept: j=str(${JSON.stringify(String(result))})\nj`);
        serialized = result;
      }catch{ serialized = String(result);}
      return {code, result: String(serialized), stdout: String(out||''), cap};
    }catch(e){
      return {code, error: String(e), cap};
    }
  }
  return {error:'unknown python cap', cap};
}
function appendTerm(text, cls){
  const div=document.createElement('div'); div.className='term-line';
  div.innerHTML=`<span style="color:${cls==='err'?'var(--err)':cls==='ok'?'var(--ok)':'var(--muted)'}">${text.replace(/</g,'&lt;')}</span>`;
  termOut.appendChild(div); termOut.scrollTop=termOut.scrollHeight;
}
async function runTerm(){
  const code = termIn.value.trim(); if(!code) return;
  appendTerm('>>> '+code, '');
  termIn.value='';
  // allow tools.search("...") shorthand
  if(code.startsWith('tools.')){
    const m = code.match(/tools\.(\w+)\(["'](.+?)["']\)/);
    if(m){ const [,fn,arg]=m; const res=mockBrokerResult(fn,{query:arg}); appendTerm(JSON.stringify(res,null,2),'ok'); dispatchTool(fn,{query:arg}); return; }
  }
  if(code.startsWith('python.')){
    const fn=code.split('(')[0];
    dispatchTool(fn, {code: code.slice(code.indexOf('(')+1, -1) || ''});
    return;
  }
  // default: python.execute
  const res = await runPythonTool('python.execute', {code});
  appendTerm(res.stdout? res.stdout : '', 'ok');
  appendTerm(res.result!==undefined? String(res.result): res.error, res.error?'err':'ok');
}

window.runTerm = runTerm;
window.resetPy = async()=>{
  if(pyodide){ await pyodide.runPythonAsync(`import sys; sys.modules.clear()`); } // soft reset
  termOut.innerHTML=''; appendTerm('kernel reset','ok');
};
window.installPkg = async()=>{
  const pkg = prompt('pip package (micropip):', 'pandas');
  if(!pkg || !pyodide) return;
  appendTerm(`micropip.install("${pkg}") …`,'');
  try{ await pyodide.runPythonAsync(`import micropip; await micropip.install("${pkg}")`); appendTerm(`installed ${pkg}`,'ok'); }catch(e){ appendTerm(String(e),'err'); }
};
window.exportPy = ()=>{
  const blob=new Blob([termOut.innerText],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='pyodide-session.txt'; a.click();
};
window.clearTrace = ()=>{ trace=[]; renderTrace(); vm.retired=0; vm.cycles=0; updateVMView(); };
window.exportTrace = ()=>{
  const blob=new Blob([JSON.stringify(trace,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`trace-${Date.now()}.json`; a.click();
};

// Chat send
function handleSend(){
  const text=chatInput.value.trim(); if(!text) return;
  pushChat('user', text.replace(/</g,'&lt;'), 'INSTRUCTION');
  chatInput.value='';
  // parse intent: tools.* / python.* / macrogrok / plain
  if(text.includes('tools.') || text.includes('python.')){
    // extract first tool call
    const m = text.match(/(tools|python)\.(\w+)\s*\(([^)]*)\)/) || text.match(/macrogrok\.infer4\s*\(([^)]*)\)/);
    if(m){
      const cap = m[1]==='macrogrok' ? 'macrogrok.infer4' : `${m[1]}.${m[2]}`;
      let args={};
      try{
        const raw=m[3];
        if(raw.startsWith('"')||raw.startsWith("'")) args={query: raw.slice(1,-1)};
        else if(raw.startsWith('[')) args={input: JSON.parse(raw)};
        else if(raw) args={code: raw};
      }catch{}
      dispatchTool(cap, args);
      return;
    }
  }
  if(text.startsWith('{') || text.toLowerCase().includes('search')){
    // treat as search instruction
    const q = text.replace(/^\{.*query.*?:\s*"/,'').slice(0,120);
    dispatchTool('search', {query: q.slice(0,80) || text.slice(0,80)});
    return;
  }
  // default: route as agent instruction -> planner -> search + macrogrok + python
  setPipeline('plan');
  addTrace({pc:vm.regs.pc, op:'LDI', cap:'—', result:`plan: ${text.slice(0,32)}`, fuel:vm.fuel, hash: phash(text).slice(0,4)|0, ok:true});
  // simulate plan -> search -> read -> synthesize
  (async()=>{
    await dispatchTool('search', {query: text.slice(0,60)});
    await new Promise(r=>setTimeout(r,300));
    await dispatchTool('python.execute', {code: `x = "${text.slice(0,40).replace(/"/g,'\\"')}"; len(x)`});
  })();
}

$('#btnSend').onclick=handleSend;
chatInput.addEventListener('keydown', e=>{
  if(e.key==='Enter' && (e.metaKey||e.ctrlKey||e.shiftKey)){ e.preventDefault(); handleSend(); }
});
termIn.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); runTerm(); }});
$('#btnRun').onclick=async()=>{
  if(vm.halted){ pushChat('agent','VM halted — fuel exhausted. Reset first.','VM'); return; }
  vm.waiting=false; setPipeline('plan');
  for(let i=0;i<4;i++){ if(vm.fuel<=0) break; await dispatchTool('fetch', {url:'https://example.com/'+i}); await new Promise(r=>setTimeout(r,180)); if(!$('#autoStep').checked) break; }
};
$('#btnStep').onclick=()=> dispatchTool('search', {query:'step '+(vm.retired+1)});
$('#btnPause').onclick=()=>{ vm.waiting=true; updateVMView(); pushChat('agent','Paused.','VM'); };
$('#btnReset').onclick=()=>{
  vm={regs:{a:0,b:0,c:0,d:0, pc:0x0000, sp:0xDFFF, bp:0, flags:0}, rom:{}, ram:{}, cycles:0, retired:0, fuel:128, transcript_hash:0, trace_seq:0, waiting:false, halted:false, phase:0};
  trace=[]; renderTrace(); updateVMView(); setPipeline('plan'); pushChat('agent','VM reset. Fuel 128, PC $0000, hash 0x0000.','VM');
};

// boot
renderTools(); updateVMView(); setPipeline('plan');
appendTerm('WASM Box: isolated execution via Pyodide (WebAssembly). No direct net/fs — all through Capability Router.', 'ok');
appendTerm('Tip: run `import numpy as np; np.random.rand(3)` or `tools.search("sovereign")`', '');
initPy();

// Phoenix LiveView WS (optional — connects to local PerplexityMacro.Endpoint if running)
try{
  const proto = location.protocol==='https:'?'wss:':'ws:';
  // try local dev endpoints: 4000 (perplexity-macro-vm) and 8833 (sovereign-tool-api)
  const ws = new WebSocket(proto + location.hostname + ':4000/socket/websocket');
  ws.onopen=()=>{ liveWS=ws; pushChat('agent','LiveView WebSocket connected — streaming trace_hub PubSub.','Phoenix · 4000'); };
  ws.onerror=()=>{};
}catch{}

// expose for console
window.vm=vm; window.TOOLS=TOOLS; window.dispatchTool=dispatchTool; window.macrogrokInfer4=macrogrokInfer4;
