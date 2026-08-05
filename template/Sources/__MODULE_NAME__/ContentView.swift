import SwiftUI

/// Your idea goes here. This is the only file you need to edit to get started.
struct ContentView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "wand.and.stars")
                .font(.largeTitle)
            Text("__APP_NAME__")
                .font(.headline)
            Text("Edit ContentView.swift to build your idea.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
