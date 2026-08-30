// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentConsole",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [
        .library(name: "AgentConsole", targets: ["AgentConsole"]),
        .executable(name: "AgentConsoleApp", targets: ["AgentConsoleApp"]),
    ],
    dependencies: [
        // JavaScript interop for Pyodide/WASM + Tokamak for GitHub Pages WASM
        // Uncomment for SwiftWasm build:
        // .package(url: "https://github.com/swiftwasm/JavaScriptKit", from: "0.20.0"),
        // .package(url: "https://github.com/TokamakUI/Tokamak", from: "0.11.0"),
    ],
    targets: [
        .target(name: "AgentConsole", dependencies: []),
        .executableTarget(name: "AgentConsoleApp", dependencies: ["AgentConsole"]),
        .testTarget(name: "AgentConsoleTests", dependencies: ["AgentConsole"]),
    ]
)
