# Perplexity Macro VM — Java SDK

Java execution runtime for the Perplexity Macro VM. Compiles to WASM via TeaVM (open) or CheerpJ (full JDK fallback).

## Structure

```
java-sdk/
├── pom.xml                          ← Maven build (TeaVM 0.9.2, Java 17)
├── src/main/java/vm/
│   ├── Main.java                    ← Entry point + execute() ABI
│   ├── Capability.java              ← WASM import bridge (search, file, clock)
│   └── Wasm.java                    ← WASM memory introspection
└── src/test/java/vm/
    └── MainTest.java                ← Unit tests
```

## Build

```bash
# Local JAR
mvn package

# WASM (TeaVM)
mvn package -P teavm
# Emits: target/macro-vm-java.wasm + target/macro-vm-java.js
```

## Toolchain

| Tool | Version | Purpose |
|------|---------|---------|
| TeaVM | 0.9.2 | Java bytecode → JS/WASM (open, no JDK needed) |
| CheerpJ | 3.0 | Full JDK in browser (fallback) |
| Java | 17 | Source level |

## Flow

```
Main.java + Capability.java + Wasm.java
   ↓ javac (Maven)
   ↓ TeaVM / CheerpJ
   target/macro-vm-java.wasm + .js
   ↓ fetch + WebAssembly.instantiate
Browser WASM runtime
   ↓ stdout/result via Capability bridge
Agent Console (Swift or JS frontend)
```

## Runtime Imports (WASM → Browser)

Capability bridge provides typed imports:
- `vm_request(cap, json)` — tool/capability request
- `file_read(path)` / `file_write(path, content)`
- `clock_now()` — ISO8601 timestamp
- `random_bytes(n)` — hex random
- `memory_size()` — WASM pages
- `stdout(msg)` / `stderr(msg)`

## License

BEL ESPRIT D ACCORD TRUST HOLDINGS INC. Patent Pending.
