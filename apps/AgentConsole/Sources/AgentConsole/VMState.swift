import Foundation

/// Perplexity Macro VM — deterministic 16-bit Word, 65_536 words, fuel-bounded
/// Mirrors PerplexityMacro.VM.State {rom, ram, regs, cycles, retired, fuel=128, transcript_hash}
public struct VMState: Equatable, Codable, Sendable {
    public struct Regs: Equatable, Codable, Sendable {
        public var a: UInt16 = 0, b: UInt16 = 0, c: UInt16 = 0, d: UInt16 = 0
        public var pc: UInt16 = 0x0000
        public var sp: UInt16 = 0xDFFF
        public var bp: UInt16 = 0
        public var flags: UInt16 = 0
    }
    public enum Phase: UInt8, Codable, Sendable { case idle=0, request=0x01, done=0x02 }
    public var regs = Regs()
    public var cycles: Int = 0
    public var retired: Int = 0
    public var fuel: Int = 128
    public var transcriptHash: UInt16 = 0
    public var traceSeq: Int = 0
    public var halted: Bool = false
    public var waiting: Bool = false
    public var phase: Phase = .idle

    /// ROM $0000-$1FFF, RAM $2000-$DFFF, MMIO $E000-$E0FF, stack descending
    public static let romBase: UInt16 = 0x0000, romEnd: UInt16 = 0x1FFF
    public static let ramBase: UInt16 = 0x2000, ramEnd: UInt16 = 0xDFFF
    public static let mmioBase: UInt16 = 0xE000

    /// Mailbox: $00 phase, $01 fuel, $02 cap, $03 status, TLV @$46 len 0xC6, CRC16 @$C6 (lib/perplexity_macro/rom.ex)
    public struct Mailbox: Sendable {
        public var phase: UInt8 { state.phase.rawValue }
        public var fuel: UInt8 { UInt8(min(255, state.fuel)) }
        public var cap: UInt8 { UInt8(state.regs.a >> 8) }
        public var status: UInt8 { state.waiting ? 0x01 : 0x00 }
        let state: VMState
    }
    public var mailbox: Mailbox { Mailbox(state: self) }

    public mutating func step(opcode: Op, capability: UInt8? = nil) -> Trace {
        traceSeq += 1; retired += 1
        cycles += opcode.cycles
        let prevFuel = fuel
        if fuel > 0 { fuel -= 1 }
        if fuel == 0 { halted = true }
        let h: UInt16 = capability.map { UInt16($0) } ?? opcode.rawValue
        transcriptHash ^= h &+ UInt16(traceSeq & 0xFF)
        regs.pc &+= 1
        let t = Trace(seq: traceSeq, pc: regs.pc &- 1, op: opcode.mnemonic, cap: capability, fuel: fuel, prevFuel: prevFuel, hash: transcriptHash, status: halted ? .trap : .ok)
        return t
    }
}

public enum Op: UInt8, CaseIterable, Sendable {
    case nop=0x00, ldi=0x01, ld=0x02, st=0x03, add=0x04, xor=0x05, cmp=0x06, jmp=0x07, jz=0x08, call=0x09, ret=0x0A, dec=0x0B, halt=0x0C
    case rq=0x20, poll=0x21, read=0x22, verify=0x23, evidence=0x24, coverage=0x25, disagree=0x26, hash=0x27, fuel=0x28, emit=0x29, confirm=0x2A
    public var mnemonic: String {
        switch self { case .nop:"NOP"; case .ldi:"LDI"; case .ld:"LD"; case .st:"ST"; case .add:"ADD"; case .xor:"XOR"; case .cmp:"CMP"; case .jmp:"JMP"; case .jz:"JZ"; case .call:"CALL"; case .ret:"RET"; case .dec:"DEC"; case .halt:"HALT"; case .rq:"RQ"; case .poll:"POLL"; case .read:"READ"; case .verify:"VERIFY"; case .evidence:"EVIDENCE"; case .coverage:"COVERAGE"; case .disagree:"DISAGREE"; case .hash:"HASH"; case .fuel:"FUEL"; case .emit:"EMIT"; case .confirm:"CONFIRM" }
    }
    public var cycles: Int {
        switch self { case .ldi:2; case .ld:3; case .st:3; case .jmp:2; case .jz:3; case .call:3; case .ret:3; case .rq:4; case .poll:2; case .read:3; case .verify:6; case .evidence:3; case .coverage:4; case .disagree:5; case .hash:8; case .emit:3; case .confirm:2; default:1 }
    }
}

public struct Trace: Identifiable, Codable, Sendable {
    public var id: Int { seq }
    public let seq: Int
    public let pc: UInt16
    public let op: String
    public let cap: UInt8?
    public let fuel: Int
    public let prevFuel: Int
    public let hash: UInt16
    public enum Status: String, Codable, Sendable { case ok, wait, trap }
    public let status: Status
    public var evidence: Bool { op=="EVIDENCE" }
}
