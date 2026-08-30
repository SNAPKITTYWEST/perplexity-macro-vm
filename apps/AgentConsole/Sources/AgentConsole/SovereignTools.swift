import Foundation

/// All 22 Sovereign Engine tools — capability-mediated, VM-owned control flow
/// 8 VM capabilities (rom.ex) + 14 Sovereign Tool API (sovereign-tool-api.mjs:220)
public enum Capability: UInt8, CaseIterable, Sendable {
    case search=0x01, fetch=0x02, browser=0x03, code=0x04, localModel=0x05, wikipedia=0x06, mathematica=0x07, dictionary=0x08
    public var sensitive: Bool { switch self { case .browser, .code, .wikipedia, .mathematica: return true; default: return false } }
}

public enum SovereignTool: String, CaseIterable, Sendable {
    // Perplexity Macro VM — 8 adapters (lib/perplexity_macro/adapters/*.ex)
    case search="search"              // Tavily POST api.tavily.com/search
    case wikipedia="wikipedia"        // w/api.php?action=query
    case mathematica="mathematica"    // WolframAlpha appid
    case dictionary="dictionary"      // dictionaryapi.dev + WordNet
    case fetch="fetch"                // generic GET allowlist + Req+Floki
    case browser="browser"            // Playwright
    case code="code"                  // bwrap/nsjail
    case local_model="local_model"    // Ollama POST /v1/chat/completions

    // Sovereign Tool API — 14 tools (bridges/sovereign-tool-api.mjs)
    case slc_evaluate="slc.evaluate"
    case slc_gate="slc.gate"
    case ere_score="ere.score"
    case quantum_temp="quantum.temp"
    case quantum_entropy="quantum.entropy"
    case worm_seal="worm.seal"
    case worm_verify="worm.verify"
    case metatron_phi="metatron.phi"
    case metatron_cube="metatron.cube"
    case swarm_run="swarm.run"
    case regex_match="regex.match"
    case agent_call="agent.call"
    case corpus_score="corpus.score"
    case colosseum_judge="colosseum.judge"

    // Sandbox + MACROGROK (harness/macro-model)
    case python_execute="python.execute"
    case python_inspect="python.inspect"
    case python_reset="python.reset"
    case python_install="python.install"
    case macrogrok_infer4="macrogrok.infer4"
    case tavily_search="tavily.search"

    public var capability: Capability? {
        switch self {
        case .search, .tavily_search: return .search
        case .fetch: return .fetch
        case .browser: return .browser
        case .code, .python_execute, .python_inspect, .macrogrok_infer4: return .code
        case .local_model: return .localModel
        case .wikipedia: return .wikipedia
        case .mathematica: return .mathematica
        case .dictionary: return .dictionary
        default: return nil
        }
    }
    public var sensitive: Bool { capability?.sensitive ?? false }
    public var tier: String {
        switch self {
        case .search, .wikipedia, .mathematica, .dictionary, .fetch: return "research"
        case .browser, .code: return "sovereign"
        case .local_model: return "local"
        case .python_execute, .python_inspect, .python_reset, .python_install, .macrogrok_infer4: return "sandbox"
        default: return "sovereign-tool-api"
        }
    }
}

/// ToolBroker — capability router → ResearchBroker → typed TLV + CRC16
/// Sensitive caps require CONFIRM (0x2A) + expiring token (rom.ex sensitive?/1)
public actor ToolBroker {
    public struct ConfirmToken: Sendable { let token: String; let expires: Date; var valid: Bool { Date() < expires } }
    private var confirm: ConfirmToken?
    private var worm: [String] = ["TOOL_API_GENESIS"]

    public init() {}

    public func requiresConfirm(_ tool: SovereignTool) -> Bool { tool.sensitive && confirm?.valid != true }

    public func confirm(capability: String) -> ConfirmToken {
        let t = ConfirmToken(token: String(UUID().uuidString.prefix(8)).uppercased(), expires: Date().addingTimeInterval(60))
        confirm = t
        return t
    }

    /// TLV envelope (title/url/content/score/source_hash at $46 crc16 @$C6) — PerplexityMacro.Evidence
    public func dispatch(instruction: AgentInstruction) async throws -> AgentResult {
        guard let tool = SovereignTool(rawValue: instruction.capability) else {
            throw BrokerError.unknownCapability(instruction.capability)
        }
        if requiresConfirm(tool) { throw BrokerError.confirmRequired(tool.rawValue) }
        if tool.sensitive { confirm = nil } // one-shot

        let payload: AnyCodable
        switch tool {
        case .search, .tavily_search: payload = AnyCodable(mockSearch(query: arg(instruction, "query") ?? "sovereign"))
        case .wikipedia: payload = AnyCodable(mockWiki(query: arg(instruction, "query") ?? "sovereign"))
        case .mathematica: payload = AnyCodable(mockMath(query: arg(instruction, "query") ?? "integral"))
        case .dictionary: payload = AnyCodable(mockDict(word: arg(instruction, "word") ?? arg(instruction, "query") ?? "sovereign"))
        case .fetch: payload = AnyCodable(["title": AnyCodable("Fetch: \(arg(instruction,"url") ?? "")"), "content": AnyCodable("allowlisted fetch")])
        case .macrogrok_infer4: payload = AnyCodable(Macrogrok.infer4(input: [0.5, -0.2, 0.8, 0.1]).asDict)
        case .python_execute: payload = AnyCodable(["code": AnyCodable(arg(instruction,"code") ?? ""), "note": AnyCodable("routed to WASM Box → Pyodide")])
        default: payload = AnyCodable(["tool": AnyCodable(tool.rawValue), "args": AnyCodable(instruction.arguments)])
        }

        // TLV + CRC16 + WORM seal (32 bytes)
        let data = try JSONEncoder().encode(payload)
        let crc = crc16(data)
        let h = phash2(String(data: data, encoding: .utf8) ?? "")
        worm.append(h)

        return AgentResult(instruction_id: instruction.instruction_id, status: "ok",
                           result: payload, source_hash: String(h.prefix(8)),
                           transcript_hash: String(format:"0x%04X", crc), fuel_remaining: instruction.fuel - 1)
    }

    private func arg(_ i: AgentInstruction, _ k: String) -> String? {
        if case .string(let s) = i.arguments[k]?.value { return s }
        return nil
    }

    enum BrokerError: Error, LocalizedError {
        case unknownCapability(String), confirmRequired(String)
        var errorDescription: String? {
            switch self { case .unknownCapability(let c): return "unknown capability: \(c)"; case .confirmRequired(let c): return "CONFIRM required for sensitive capability: \(c) (0x2A)" }
        }
    }
}

// Mocks matching adapters/*.ex normalize
private func mockSearch(query: String) -> [String: AnyCodable] { ["title": AnyCodable("Tavily: \(query) — advanced"), "url": AnyCodable("https://api.tavily.com/search?q=\(query)"), "content": AnyCodable("POST https://api.tavily.com/search search_depth=advanced max_results=5"), "score": AnyCodable(0.92), "source_hash": AnyCodable(phash2(query))] }
private func mockWiki(query: String) -> [String: AnyCodable] { ["title": AnyCodable("Wikipedia: \(query)"), "url": AnyCodable("https://en.wikipedia.org/wiki/\(query)"), "content": AnyCodable("GET w/api.php?action=query&prop=extracts&titles=\(query)"), "score": AnyCodable(0.88), "source_hash": AnyCodable(phash2(query))] }
private func mockMath(query: String) -> [String: AnyCodable] { ["title": AnyCodable("WolframAlpha: \(query)"), "url": AnyCodable("https://api.wolframalpha.com/v1/query?input=\(query)"), "content": AnyCodable("Mathematica result"), "score": AnyCodable(0.85), "source_hash": AnyCodable(phash2(query))] }
private func mockDict(word: String) -> [String: AnyCodable] { ["word": AnyCodable(word), "source_hash": AnyCodable(phash2(word))] }
