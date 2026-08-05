import AppKit

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        LaunchAtLogin.applyDefaultOnFirstRun()
        if AppConfig.dockPolicy == .hideOnClose {
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(windowWillClose(_:)),
                name: NSWindow.willCloseNotification,
                object: nil
            )
        }
    }

    @objc private func windowWillClose(_ notification: Notification) {
        // Defer so the closing window no longer counts as visible.
        DispatchQueue.main.async {
            let hasVisibleWindow = NSApp.windows.contains { $0.isVisible && $0.canBecomeKey }
            if !hasVisibleWindow {
                NSApp.setActivationPolicy(.accessory)
            }
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if AppConfig.dockPolicy == .hideOnClose {
            NSApp.setActivationPolicy(.regular)
            NSApp.activate(ignoringOtherApps: true)
        }
        return true
    }
}
