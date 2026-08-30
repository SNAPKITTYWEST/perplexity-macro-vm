import Foundation

/// WASM Box — isolated execution (Pyodide/WASM). No direct net/fs.
/// Python execution is mediated → Capability Router → ResearchBroker.
///
/// JS side: Pyodide via https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js
/// Use Web Worker so long compute doesn't block UI (Pyodide docs: Web Workers).
///
/// Swift API mirrors python.execute / inspect / reset / install / export
#if canImport(JavaScriptKit)
import JavaScriptKit
#endif

public enum WASMError: Error { case notReady, executionFailed(String) }

public actor WASMBox {
    public enum Status: String, Sendable { case loading, ready, offline }
    public private(set) var status: Status = .loading
    public private(set) var pyodideVersion: String?

    // In SwiftWasm build, this bridges to JS Pyodide instance
    private var jsPyodide: Any?

    public init() {}

    /// Called from JS once Pyodide ready (postMessage from worker)
    public func markReady(version: String) { status = .ready; pyodideVersion = version }

    /// python.execute — isolated, returns stdout + result (no host access)
    public func execute(code: String) async throws -> PythonResult {
        guard status == .ready else { throw WASMError.notReady }
        // In real SwiftWasm: JSObject.global.pyodide.runPythonAsync(code)
        // Here we simulate deterministic execution for previews/tests
        if code.contains("import numpy") { return PythonResult(stdout: "", result: "[0. 0. 0.]", code: code) }
        if code.contains("tools.search") { return PythonResult(stdout: "mediated via Capability Router", result: "{\"results\":[{\"title\":\"Tavily\"}]}", code: code) }
        return PythonResult(stdout: "", result: "42", code: code)
    }

    public func inspect() async -> String { "['tools','np','__builtins__']" }
    public func reset() async { /* pyodide.runPython("import sys; sys.modules.clear()") */ }
    public func install(package: String) async throws { /* micropip.install(package) */ }

    public struct PythonResult: Codable, Sendable {
        public let stdout: String
        public let result: String
        public let code: String
    }
}

/// Macrogrok fixed-point — Q1.14/Q3.12 INFER4 (examples/infer4.asm + src/sim.py)
public enum Macrogrok {
    /// INFER4: CLR FLAGS → DOT4 → ACC_TO_Q3_12 → ADD BIAS → SAT → THRESHOLD → UPDATE_STATE_3_4
    public static func infer4(input: [Double]) -> InferResult {
        let weights: [Int] = [2458, -1638, 819, 3277] // Q1.14 ROM
        let bias: Double = -256.0 / 4096.0 // Q3.12
        var acc: Int = 0
        for i in 0..<min(4, input.count) {
            let q = Int((input[i] * 16384).rounded())
            acc += (q * weights[i]) / 16384 // Q2.28-ish
        }
        let q324 = Double(acc) / 16.0
        let q312 = q324 / 4096.0
        var score = q312 + bias
        score = max(-2, min(1.999, score))
        let thr: Double = score >= 1 ? 1 : score <= -1 ? -1 : score
        // STATE smoothing (3*STATE+TARGET)/4
        let prev = UserDefaults.standard.double(forKey: "mg_state")
        let next = (3*prev + thr)/4
        UserDefaults.standard.set(next, forKey: "mg_state")
        let flags = (abs(score) > 1.9 ? 2 : 0) | (score > 0 ? 4 : 0) | 1
        return InferResult(input: input, weights: weights, bias: -256, acc: acc, score: score, output: next, flags: flags, state: next)
    }

    public struct InferResult: Codable, Sendable {
        public let input: [Double]; public let weights: [Int]; public let bias: Int
        public let acc: Int; public let score: Double; public let output: Double; public let flags: Int; public let state: Double
        public var asDict: [String: AnyCodable] {
            ["input": AnyCodable(input.map{ AnyCodable($0)}),
             "weights_Q1_14": AnyCodable(weights.map{ AnyCodable($0)}),
             "bias_Q3_12": AnyCodable(bias),
             "acc": AnyCodable(acc),
             "score": AnyCodable(score),
             "output": AnyCodable(output),
             "flags": AnyCodable(String(format:"0b%03d", Int(String(flags, radix:2))!)),
             "state": AnyCodable(state)]
        }
    }
}
