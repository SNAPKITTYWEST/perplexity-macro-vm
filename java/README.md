# Java → WASM Pipeline (TeaVM 0.9.2 + CheerpJ 3.0 fallback)

Browser receives WASM artifact and executes Java inside the WASM sandbox. No native JDK required on user machine.

## Toolchain (pinned, reproducible)

- **Primary (open):** TeaVM 0.9.2 — Java bytecode → JS/WASM — `org.teavm:teavm-maven-plugin:0.9.2` / `teavm-gradle`
- **Fallback (full JDK):** CheerpJ 3.0 `https://cjrtnc.leaningtech.com/3.0/cj3loader.js` — OpenJDK 11 compiled to WASM/JS, runs `javac` + `java` in browser
- **Java:** OpenJDK 17 source level, TeaVM target JS/WASM

## Build

```bash
# TeaVM (open, local)
./gradlew :java:teavm  # emits wasm/java.wasm + wasm/java.js (see wasm/README.md)
# Or Maven
mvn -pl java teavm:compile

# CheerpJ (browser, zero install) — runtime does:
#   cheerpjInit() → virtual FS → javac Main.java → java Main
# Browser loads wasm/java.wasm via wasm/java-wasm.js (generated)

# Reproducible pins
# teavm.version=0.9.2  cheerpj.version=3.0  wasm.version=1
# Checksums recorded in wasm/SHASUMS
```

## Flow

```
Main.java + Capability.java
   ↓ javac (TeaVM or CheerpJ in-WASM javac)
   ↓ teavm/CheerpJ
wasm/java.wasm (+ js glue)
   ↓ fetch + WebAssembly.instantiate
Browser WASM runtime
   ↓ stdout/stderr/result/artifacts via Capability bridge
```

## Runtime imports (WASM → browser)

Capability bridge provides typed imports: `vm_request(cap, json)`, `file_read`, `file_write`, `clock`, `random`, `stdout`, `stderr`, `memory`. Separated deterministic (memory, files) vs nondeterministic (clock, random, tool calls).

See `Capability.java:6` and `wasm/java-wasm.js:1` for imports, and `agent-console/app.js` capability bridge for routing to local or Swift gateway.
