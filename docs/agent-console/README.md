# Perplexity Macro VM — Agent Console (GitHub Pages)

Super-clean control surface. Phoenix LiveView-ready, static-fallback.

```
PHOENIX LIVEVIEW
  Agent Console
    instruction → PLAN → EXECUTE → OBSERVE
    VM Trace | Memory | Tools | Python
                 │
          AGENT RUNTIME
            instruction model
            planner · tool dispatcher
                 │
     ┌───────────┼───────────┐
     ▼           ▼           ▼
  Macro VM   WASM Box   Tool Broker
  16-bit     Python     search/fetch/browser/code/local_model/wikipedia/mathematica/dictionary
  control    IPython    + sovereign-tool-api (14 tools) + macrogrok
```

## Files

- `index.html` — super-clean UI (no build). GitHub Pages: `docs/` is root, so `https://<user>.github.io/<repo>/agent-console/`
- `app.js` — VM (16-bit fuel 128), Capability Router (CONFIRM 0x2A), Pyodide bridge, Tool Broker, LiveView WS
- `tool_router.ex` / `wasm_box.ex` / `agent_console_live.ex` — copy into `perplexity-macro-vm/lib/` to enable real Phoenix PubSub + 50k TraceHub ring

## Run locally

```bash
# static only
python -m http.server 8000 --directory docs
# open http://localhost:8000/agent-console/

# with Phoenix LiveView
cd perplexity-macro-vm
mix deps.get && mix phx.server
# LiveView at http://localhost:4000/agent_console — static console auto-upgrades WS
```

## Swift

`apps/AgentConsole/` — Swift package (Tokamak/SwiftWasm ready). Same VM/instruction/ToolBroker/WASMBox types as `app.js`, for native macOS/iOS + browser WASM via `carton`.

```bash
swift run AgentConsoleApp
```

## Tools (22, all mediated)

VM `0x01-0x08`: search, fetch, browser*, code*, local_model, wikipedia*, mathematica*, dictionary (*=CONFIRM). Sovereign Tool API: slc.evaluate, slc.gate, ere.score, quantum.temp, quantum.entropy, worm.seal, worm.verify, metatron.phi, metatron.cube, swarm.run, regex.match, agent.call, corpus.score, colosseum.judge. Sandbox: python.execute/inspect/reset/install, macrogrok.infer4, tavily.search.

IPython inside WASM has **no direct net/fs** — `tools.search()` is intercepted → Capability Router → ResearchBroker → TLV@$46 CRC16@$C6 → VM.

## VM Contract

Word 16-bit, ROM $0000-$1FFF RAM $2000-$DFFF MMIO $E000, regs A,B,C,D PC SP=0xDFFF, fuel 128, transcript_hash. Mailbox $00 phase $01 fuel $02 cap $03 status. RQ/POLL/READ/VERIFY/EVIDENCE/COVERAGE/DISAGREE/HASH/EMIT/CONFIRM.

