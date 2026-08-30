import Foundation

/// AgentConsole — super-clean Swift front end for Perplexity Macro VM + MACROGROK
/// View layer is Tokamak (SwiftWasm) targeting GitHub Pages static hosting.
/// This file defines the observable state; Views are in AgentConsoleView.swift (if Tokamak available).

@MainActor
public final class AgentConsoleModel: ObservableObject {
    @Published public var vm = VMState()
    @Published public var traces: [Trace] = []
    @Published public var messages: [ChatMessage] = [
        .init(role: .system, text: "Phoenix LiveView control surface online. VM owns control, Host owns evidence, WASM owns execution.")
    ]
    @Published public var input: String = ""
    @Published public var agent: String = "research"
    @Published public var selectedTool: SovereignTool? = nil

    private let broker = ToolBroker()
    private let wasm = WASMBox()

    public init() {}

    public struct ChatMessage: Identifiable, Equatable, Sendable {
        public let id = UUID()
        public enum Role: String, Sendable { case system, user, agent }
        public let role: Role
        public let text: String
    }

    public func send(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        messages.append(.init(role: .user, text: text))
        Task { await dispatchInstruction(text) }
    }

    private func dispatchInstruction(_ text: String) async {
        // Simple plan: decompose → search → python → synthesize (programs/research_loop.pqm)
        let caps: [(String, [String:AnyCodable])] = [
            ("search", ["query": AnyCodable(text.prefix(60).description)]),
            ("python.execute", ["code": AnyCodable("len(\"\(text.prefix(40))\")")]),
        ]
        for (cap, args) in caps {
            let instr = AgentInstruction.make(agent: agent, capability: cap, arguments: args, fuel: 8, transcript: vm.transcriptHash)
            do {
                let res = try await broker.dispatch(instruction: instr)
                let t = vm.step(opcode: .rq, capability: SovereignTool(rawValue: cap)?.capability?.rawValue)
                traces.insert(t, at: 0)
                messages.append(.init(role: .agent, text: "\(cap) → \(res.source_hash) fuel \(res.fuel_remaining)"))
            } catch {
                messages.append(.init(role: .agent, text: "ERR \(cap): \(error.localizedDescription) — CONFIRM 0x2A required"))
            }
        }
    }

    public func confirm() async {
        let tok = await broker.confirm(capability: "browser")
        messages.append(.init(role: .system, text: "CONFIRM token \(tok.token) (60s) — sensitive capability unlocked (one-shot)"))
    }

    public func runPython(_ code: String) async {
        do {
            let r = try await wasm.execute(code: code)
            messages.append(.init(role: .agent, text: "python → \(r.result)"))
        } catch {
            messages.append(.init(role: .agent, text: "python err: \(error)"))
        }
    }
}
