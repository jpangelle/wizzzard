import SwiftUI

struct SettingsView: View {
    @State private var launchAtLogin = LaunchAtLogin.isEnabled

    var body: some View {
        Form {
            Section {
                Toggle("Launch at login", isOn: $launchAtLogin)
                    .onChange(of: launchAtLogin) { _, newValue in
                        LaunchAtLogin.isEnabled = newValue
                        // Re-read: registration can fail or await user approval.
                        launchAtLogin = LaunchAtLogin.isEnabled
                    }
            }
            Section("__APP_NAME__") {
                Text("Add your app's settings here (SettingsView.swift).")
                    .foregroundStyle(.secondary)
            }
        }
        .formStyle(.grouped)
        .frame(width: 380)
        .fixedSize()
    }
}
