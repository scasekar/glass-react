import SwiftUI

struct ContentView: View {
    @Binding var colorScheme: ColorScheme
    @State private var glassVariant: Glass = .clear
    @State private var captureMode: Bool = false
    @State private var wallpaperName: String = "wallpaper"

    var body: some View {
        ZStack {
            // Layer 1: Full-bleed wallpaper
            // The landscape wallpaper (1920x1080) fills the portrait screen via
            // scaledToFill. The sky (bright area) is at the top. Offset the image
            // upward so the mountains/clouds (more varied tones) sit behind the
            // glass elements, making the glass effect visible.
            GeometryReader { geo in
                Image(wallpaperName)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: geo.size.width, height: geo.size.height * 1.3)
                    .offset(y: -geo.size.height * 0.15)
            }
            .ignoresSafeArea()

            // Layer 2: Glass UI elements
            GlassEffectContainer {
                VStack(spacing: 16) {
                    // 1. Navigation bar
                    HStack {
                        Image(systemName: "chevron.left")
                        Spacer()
                        Text("Reference")
                            .font(.headline)
                        Spacer()
                        Image(systemName: "ellipsis")
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .glassEffect(glassVariant, in: RoundedRectangle(cornerRadius: 16))

                    // 2. Search bar (capsule)
                    HStack {
                        Image(systemName: "magnifyingglass")
                        Text("Search")
                            .foregroundStyle(.secondary)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .glassEffect(glassVariant, in: .capsule)

                    // 3. Large glass panel (card/sheet)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Glass Panel")
                            .font(.title2)
                            .fontWeight(.semibold)
                        Text("This panel demonstrates the native Liquid Glass material rendering. It serves as the ground truth for web demo comparison.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(20)
                    .glassEffect(glassVariant, in: RoundedRectangle(cornerRadius: 28))

                    Spacer()

                    // 4. Floating pill button
                    Text("Action Button")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .glassEffect(glassVariant, in: .capsule)
                }
                .padding()
            }

            // Layer 3: Controls overlay (hidden in capture mode)
            if !captureMode {
                VStack {
                    Spacer()
                    controlsOverlay
                        .padding(.bottom, 60)
                }
            }
        }
    }

    private var controlsOverlay: some View {
        HStack(spacing: 16) {
            Button(glassVariant == .regular ? "Regular" : "Clear") {
                glassVariant = (glassVariant == .regular) ? .clear : .regular
            }
            Button(colorScheme == .light ? "Light" : "Dark") {
                colorScheme = (colorScheme == .light) ? .dark : .light
            }
            Button(captureMode ? "Show UI" : "Capture") {
                captureMode.toggle()
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
}
