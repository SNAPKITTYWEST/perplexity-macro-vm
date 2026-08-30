# AgentConsole — Swift front end for Perplexity Macro VM

Super-clean Swift (Tokamak/SwiftWasm) + GitHub Pages static console. VM owns control flow, `RQ` requests capabilities, `ResearchBroker` returns typed TLV + CRC16, LiveView streams `TraceHub`.

```
                    PHOENIX LIVEVIEW (Agent Console)
        instruction → PLAN → EXECUTE → OBSERVE   VM Trace | Memory | Tools | Python
                            │
                   AGENT RUNTIME (instruction model · planner · dispatcher)
                            │
              ┌─────────────┼──────────────┐
              ▼             ▼              ▼
        Macro VM      WASM Box       Tool Broker
        16-bit        Python         search/fetch/browser/code/local_model/wikipedia/mathematica/dictionary
        ROM/RAM       IPython        + 14 Sovereign Tool API (slc/ere/quantum/worm/swarm/...)
                      Pyodide        (sovereign-tool-api.mjs:220)
```

## Swift package

```bash
swift build
swift run AgentConsoleApp
swift test
# SwiftWasm (GitHub Pages):
# carton build --product AgentConsole --deployment-target browser
```

## GitHub Pages

Static console at `docs/agent-console/` — no server. Phoenix LiveView WS optional (`ws://localhost:4000/socket/websocket`). Pyodide loaded from CDN, Web Worker-friendly.

## Sandbox

`python.execute / inspect / reset / install / export` — **no direct net/fs**. `tools.search(...)` inside Python is mediated → Capability Router → policy check → ResearchBroker → typed result → Python.

## Tools (22)

VM caps `0x01-0x08` (sensitive `browser/code/wikipedia/mathematica` require `CONFIRM 0x2A` + expiring token): search, fetch, browser, code, local_model, wikipedia, mathematica, dictionary. Sovereign Tool API: slc.evaluate, slc.gate, ere.score, quantum.temp, quantum.entropy, worm.seal, worm.verify, metatron.phi, metatron.cube, swarm.run, regex.match, agent.call, corpus.score, colosseum.judge. Sandbox: python.*, macrogrok.infer4, tavily.search.

## VM Contract

Word 16-bit, ROM $0000-$1FFF RAM $2000-$DFFF MMIO $E000, regs A,B,C,D PC SP=0xDFFF, fuel 128, transcript_hash. Mailbox $00 phase $01 fuel $02 cap $03 status, TLV @$46 CRC16 @$C6 (lib/perplexity_macro/rom.ex).

## References

- `perplexity-macro-vm/lib/perplexity_macro/rom.ex`, `capability.ex`, `research/broker.ex`, `vm/state.ex`
- `bob-orchestrator/bridges/sovereign-tool-api.mjs` (14 tools)
- Pyodide https://pyodide.org/en/stable/usage/index.html
