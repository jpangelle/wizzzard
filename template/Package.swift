// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "__MODULE_NAME__",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "__MODULE_NAME__",
            path: "Sources/__MODULE_NAME__"
        )
    ]
)
