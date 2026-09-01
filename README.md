# Perplexity Macro VM

**Sovereign Source License v1.0** — Copyright (c) 2026 Ahmad Ali Parr + Jessica Westerhoff, BEL ESPRIT D ACCORD TRUST HOLDINGS INC. Patent Pending.

Deterministic 16-bit research VM that runs Perplexity-style planning, search, evidence, critique, and synthesis compiled to ROM. Elixir GenServer OTP + Phoenix LiveView streams every retired instruction. Host does web/model/code work behind typed capability boundaries; VM owns control flow.

> **Live Agent Console** — https://snapkittywest.github.io/perplexity-macro-vm/

## Features

- **Ollama / OpenAI / OpenRouter** model integration (local or cloud)
- **Python execution** via Pyodide (runs in browser, no server needed)
- **Web search** via DuckDuckGo (client-side)
- **Terminal tools** (client-side simulation, backend-ready)
- **Tool calling protocol** — model can invoke tools automatically
- **Deterministic VM** — 16-bit, 65K words, typed capabilities, transcript hashing

## Architecture

```
                Phoenix LiveView (trace | regs | memory | graph)
                              ^ PubSub
                     TraceHub (ring buffer 50k)
                              ^ {:retired, trace}
MacroVM GenServer — fetch/decode/execute -> commit -> emit one trace
      ^ capability request | host result v
ResearchBroker (search/fetch/LLM/evidence)   Compiler (.pqm -> ROM)
```

VM owns control flow and acceptance policy. Host returns typed evidence records to a waiting `RQ` instruction.

## VM Contract

```
Word: 16 bits, 65,536 words
ROM: $0000-$1FFF  RAM: $2000-$DFFF  MMIO: $E000-$E0FF  Stack: descending, RAM-backed
Regs: A,B,C,D, PC, SP=0xDFFF, BP, FLAGS
Cycles: fixed per opcode
State: %State{rom, ram, regs, cycles, retired, halted?, waiting?, fuel=128, transcript_hash, breakpoints, watches, trace_seq}
```

## Instruction Set

| Op | Mnemonic | Cyc | Meaning |
|---|---|---|---|
| 00 | NOP | 1 | |
| 01 | LDI r,imm16 | 2 | |
| 02 | LD r,[addr] | 3 | |
| 03 | ST [addr],r | 3 | |
| 04 | ADD rd,rs | 1 | |
| 05 | XOR rd,rs | 1 | |
| 06 | CMP ra,rb | 1 | |
| 07 | JMP addr | 2 | |
| 08 | JZ addr | 2/3 | |
| 09 | CALL addr | 3 | |
| 0A | RET | 3 | |
| 0B | DEC r | 1 | |
| 0C | HALT code | 1 | |
| 20 | RQ cap,ptr,len | 4 | capability request |
| 21 | POLL rd | 2 | status |
| 22 | READ rd,off | 3 | host result word |
| 23 | VERIFY ptr,len | 6 | schema/CRC |
| 24 | EVIDENCE claim,src | 3 | provenance |
| 25 | COVERAGE rd | 4 | cited-claim coverage |
| 26 | DISAGREE rd | 5 | contradiction flags |
| 27 | HASH ptr,len | 8+ | transcript hash |
| 28 | FUEL | 1 | trap at zero |
| 29 | EMIT kind,ptr,len | 3 | checkpoint |
| 2A | CONFIRM cap | 2 | one-shot auth |

Capabilities: `01=search 02=fetch 03=browser 04=code 05=local_model 06=file_read 07=file_write 08=calendar 09=email` — sensitive require `CONFIRM` + expiring token.

## Agent Console

**Live:** https://snapkittywest.github.io/perplexity-macro-vm/

Clean chat interface with tool calling:

1. **Connect** — Pick provider (Ollama/OpenRouter/OpenAI), enter credentials
2. **Chat** — Ask anything, model can call tools automatically
3. **Tools** — Python (Pyodide), web search (DuckDuckGo), terminal
4. **Terminal panel** — Toggle to see tool execution log

```
Onboarding -> Provider Selection -> Chat Interface
                                         |
                              Tool Detection (```python, ```search, ```terminal)
                                         |
                              Tool Execution (Pyodide / API / simulated)
                                         |
                              Result -> Model -> Answer
```

### Tool Calling

The model can invoke tools by emitting fenced code blocks:

```python
# Python execution (Pyodide, runs in browser)
import numpy as np
print(np.mean([1, 2, 3, 4, 5]))
```

```search
WebGPU latest news 2025
```

```terminal
ls -la
```

Results are fed back to the model for synthesis.

### Run locally

```bash
# Just open the HTML file
open docs/agent-console/index.html

# Or serve with Python
cd docs/agent-console && python -m http.server 8080
```

## Macro Language .pqm

`programs/research_loop.pqm` — declarative research logic compiled to ROM.

```
program research_loop
const fuel_budget=12, min_sources=3
entry: fuel fuel_budget
plan:  request search, query("topic decomposition") -> await -> verify -> branch_invalid retry_plan
search: request search, subquestion batch -> await -> verify -> evidence -> coverage -> branch_lt min_sources, search
read: request fetch, selected -> await -> verify -> evidence -> disagreement -> branch_true critique
synthesize: request local_model, render_cited_answer -> await -> verify -> emit final -> halt
critique: request search, counterevidence -> await -> verify -> jump synthesize
```

Compiler: `lexer -> parser -> typed AST -> policy checker -> CFG -> label resolution -> opcode selection -> .pqr + .pqmap + manifest.json`.

## API Endpoints (Research Host)

All via `ResearchBroker` -> `Adapters.*`. Every adapter returns normalized TLV-compatible maps with `source_hash`.

* **Tavily** `Adapters.Search` — `POST https://api.tavily.com/search`
* **Wikipedia** `Adapters.Wikipedia` — `GET https://en.wikipedia.org/w/api.php`
* **Mathematica** `Adapters.Mathematica` — `POST https://api.wolframalpha.com/v1/query`
* **Dictionary** `Adapters.Dictionary` — `GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>`
* **Fetch** `Adapters.Fetch` — generic GET with allowlist
* **Browser** `Adapters.Browser` — Playwright automation
* **Code** `Adapters.Code` — sandboxed Python/JS
* **Local Model** `Adapters.LocalModel` — Ollama/LM Studio

## Run (Elixir Backend)

```bash
mix deps.get
mix test
iex -S mix
# Phoenix at http://localhost:4000
mix compile.pqm programs/research_loop.pqm --out priv/rom/
```

## Layout

```
cfg/macro_rom.cfg
asm/crc16.s
docs/agent-console/          # Frontend (static, GitHub Pages)
apps/AgentConsole/           # Swift frontend
java-sdk/                    # Java SDK (Maven)
lib/perplexity_macro/        # Elixir backend
proofs/MacroProtocol.lean    # Verification
programs/research_loop.pqm   # VM programs
priv/rom/                    # Compiled ROM
```

## License

**Sovereign Source License v1.0**

Copyright (c) 2026 Ahmad Ali Parr + Jessica Westerhoff
BEL ESPRIT D ACCORD TRUST HOLDINGS INC.

This software is provided under the Sovereign Source License. Use, modification, and distribution are permitted only as authorized by the copyright holders. Patent Pending.
