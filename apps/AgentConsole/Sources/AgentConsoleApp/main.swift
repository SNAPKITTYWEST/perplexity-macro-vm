import AgentConsole
import Foundation

// CLI entry for local testing (mirrors Phoenix LiveView boot)
@main
struct AgentConsoleApp {
    static func main() async {
        print("◇ Perplexity Macro VM — Agent Console (Swift)")
        print("  VM 16-bit fuel=128 · WASM Box · IPython sandbox · 22 tools")
        var vm = VMState()
        let t = vm.step(opcode: .rq, capability: 0x01)
        print("  trace #\(t.seq) \(t.op) cap 0x01 hash 0x\(String(t.hash, radix:16)) fuel \(t.fuel)")
        let r = Macrogrok.infer4(input: [0.5, -0.2, 0.8, 0.1])
        print("  macrogrok infer4 score \(r.score) output \(r.output) flags \(String(r.flags, radix:2))")
        let instr = AgentInstruction.make(capability: "search", arguments: ["query": AnyCodable("attention WMMA")])
        print("  instruction \(instr.instruction_id) cap \(instr.capability)")
        let broker = ToolBroker()
        do {
            let res = try await broker.dispatch(instruction: instr)
            print("  evidence \(res.source_hash) crc \(res.transcript_hash)")
        } catch {
            print("  broker err \(error)")
        }
        // WASM
        let box = WASMBox()
        await box.markReady(version: "0.26.4")
        if let out = try? await box.execute(code: "import math; math.sqrt(9)") {
            print("  python \(out.result)")
        }
    }
}
