# Perplexity Macro VM — Deterministic 16-bit Research VM

**Patent Pending — BEL ESPRIT D ACCORD TRUST HOLDINGS INC.**

Deterministic 16-bit research VM that runs Perplexity-style planning → search → evidence → critique → synthesis compiled to ROM. Elixir GenServer OTP + Phoenix LiveView streams every retired instruction. Host does web/model/code work behind typed capability boundaries; VM owns control flow.

## Architecture

```
                Phoenix LiveView (trace | regs | memory | graph)
                              ^ PubSub
                     TraceHub (ring buffer 50k)
                              ^ {:retired, trace}
MacroVM GenServer — fetch/decode/execute → commit → emit one trace
      ^ capability request | host result v
ResearchBroker (search/fetch/LLM/evidence)   Compiler (.pqm → ROM)
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

Capabilities: `01=search 02=fetch 03=browser 04=code 05=local_model 06=file_read 07=file_write 08=calendar 09=email` — sensitive require `CONFIRM` + expiring token. See `lib/perplexity_macro/capability.ex`.

## Macro Language `.pqm`

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

Compiler: `lexer -> parser -> typed AST -> policy checker -> CFG -> label resolution -> opcode selection -> .pqr + .pqmap + manifest.json`. Rejects unbounded back-jumps without `FUEL`, sensitive caps without `CONFIRM`, unreachable `HALT`, ROM writes, `EMIT final` without coverage.

## API Endpoints (Research Host)

All via `ResearchBroker` → `Adapters.*`. Every adapter returns normalized TLV-compatible maps with `source_hash`.

* **Tavily** `Adapters.Search` — `POST https://api.tavily.com/search` (`search_depth=advanced`, `max_results=5`)
* **Wikipedia** `Adapters.Wikipedia` — `GET https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext&titles=`
* **Mathematica** `Adapters.Mathematica` — `POST https://api.wolframalpha.com/v1/query?appid=&input=` (or local `WolframEngine` bridge)
* **Dictionary** `Adapters.Dictionary` — `GET https://api.dictionaryapi.dev/api/v2/entries/en/<word>` + local `WordNet` fallback
* **Fetch** `Adapters.Fetch` — generic `GET` with allowlist, size/MIME/rate limits, `Req` + `Floki` extract
* **Browser** `Adapters.Browser` — `Playwright` automation, canonicalize URL
* **Code** `Adapters.Code` — sandboxed `bwrap`/`nsjail` Python/JS
* **Local Model** `Adapters.LocalModel` — `Ollama`/`LM Studio` `POST /v1/chat/completions`

Each result TLV: `{title, url, content, score, source_hash: phash2(url)}` at `0x46` length `0xC6` CRC16.

## Host — ROM Mailbox

Zero-page `$00:$00=phase $01=fuel $02=cap $03=status`. Host `ROM` GenServer (`:ets` `:rom_mailbox`) bridges emulator: `handle_call {:read_mailbox}` → `cap/query/nonce`, `handle_cast {:write_result, tlv, crc16}` → writes `0x46` + `0xC6` + `STATUS=0x02`. See `lib/perplexity_macro/rom.ex` and `cfg/macro_rom.cfg` (`ZP $0000/0100`, `ROM $8000/8000`).

## Verification Targets (Lean)

* PC in ROM, no ROM writes, `FUEL` halts loops, every `cycles` increment, `RQ` only manifest caps, `CONFIRM` for sensitive, `EMIT final` requires coverage, replay determinism (registers/RAM/page hashes). See `proofs/MacroProtocol.lean`.

## Layout

```
cfg/macro_rom.cfg
asm/crc16.s
lib/perplexity_macro/{rom,capability,compiler,lexer,parser,policy,vm/{state,decoder,executor,memory,inspector,trace},research/{broker,evidence,mailbox,adapters/{search,wikipedia,mathematica,dictionary,fetch,browser,code,local_model}},trace_hub}
proofs/MacroProtocol.lean
programs/research_loop.pqm
priv/rom/research_loop.pqr
test/
```

## Run

```bash
mix deps.get
mix test
iex -S mix  # PerplexityMacro.Application starts ROM + VM + TraceHub + Endpoint
# Phoenix LiveView at http://localhost:4000 — Run/Step/Pause, trace table, memory hex
mix compile.pqm programs/research_loop.pqm --out priv/rom/
```

## Legal

Copyright (c) 2026 BEL ESPRIT D ACCORD TRUST HOLDINGS INC. Patent Pending.
