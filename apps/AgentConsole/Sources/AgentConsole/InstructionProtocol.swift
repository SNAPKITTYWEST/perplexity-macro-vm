import Foundation

/// Agent instruction protocol — model is instruction generator, VM is execution authority
/// Mirrors docs/agent-console spec + rom.ex mailbox
public struct AgentInstruction: Codable, Sendable, Identifiable {
    public var id: String { instruction_id }
    public let instruction_id: String
    public let agent: String          // research | macrogrok | sovereign
    public let op: String             // tool_call
    public let capability: String     // search | fetch | python.execute | macrogrok.infer4 | ...
    public let arguments: [String: AnyCodable]
    public let expected: String       // evidence
    public let fuel: Int
    public let transcript_hash: UInt16?

    public static func make(agent: String = "research", capability: String, arguments: [String: AnyCodable] = [:], fuel: Int = 8, transcript: UInt16 = 0) -> Self {
        .init(instruction_id: String(UUID().uuidString.prefix(8)).uppercased(),
              agent: agent, op: "tool_call", capability: capability,
              arguments: arguments, expected: "evidence", fuel: fuel, transcript_hash: transcript)
    }
}

public struct AgentResult: Codable, Sendable {
    public let instruction_id: String
    public let status: String         // ok | err
    public let result: AnyCodable
    public let source_hash: String    // phash2(url) capped 8 hex
    public let transcript_hash: String
    public let fuel_remaining: Int
}

/// Type-erased Codable for arbitrary tool args (JSON)
public struct AnyCodable: Codable, Sendable, Equatable {
    public let value: AnySentinel
    public enum AnySentinel: Equatable, Sendable { case string(String), int(Int), double(Double), bool(Bool), null, array([AnyCodable]), object([String:AnyCodable]) }
    public init(_ v: String){ value = .string(v) }
    public init(_ v: Int){ value = .int(v) }
    public init(_ v: Double){ value = .double(v) }
    public init(_ v: Bool){ value = .bool(v) }
    public init(_ v: [AnyCodable]){ value = .array(v) }
    public init(_ v: [String:AnyCodable]){ value = .object(v) }
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil(){ value = .null }
        else if let b = try? c.decode(Bool.self){ value = .bool(b) }
        else if let i = try? c.decode(Int.self){ value = .int(i) }
        else if let d = try? c.decode(Double.self){ value = .double(d) }
        else if let s = try? c.decode(String.self){ value = .string(s) }
        else if let a = try? c.decode([AnyCodable].self){ value = .array(a) }
        else if let o = try? c.decode([String:AnyCodable].self){ value = .object(o) }
        else { value = .null }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch value {
        case .string(let s): try c.encode(s)
        case .int(let i): try c.encode(i)
        case .double(let d): try c.encode(d)
        case .bool(let b): try c.encode(b)
        case .null: try c.encodeNil()
        case .array(let a): try c.encode(a)
        case .object(let o): try c.encode(o)
        }
    }
}

// Convenience helpers
extension AnyCodable: ExpressibleByStringLiteral { public init(stringLiteral value: String){ self.init(value) } }
extension AnyCodable: ExpressibleByIntegerLiteral { public init(integerLiteral value: Int){ self.init(value) } }

public func phash2(_ s: String) -> String {
    var h: UInt32 = 0
    for u in s.unicodeScalars { h = h &* 31 &+ UInt32(u.value) }
    return String(format: "%08x", h)
}
public func crc16(_ data: Data) -> UInt16 {
    var crc: UInt16 = 0xFFFF
    for b in data { crc ^= UInt16(b) << 8; for _ in 0..<8 { crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1 } }
    return crc
}
