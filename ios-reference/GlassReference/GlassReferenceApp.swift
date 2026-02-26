import SwiftUI

@main
struct GlassReferenceApp: App {
    @State private var colorScheme: ColorScheme = .light

    var body: some Scene {
        WindowGroup {
            ContentView(colorScheme: $colorScheme)
                .preferredColorScheme(colorScheme)
        }
    }
}
