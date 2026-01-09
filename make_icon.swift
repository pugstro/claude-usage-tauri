import Foundation
import AppKit

let size = NSSize(width: 22, height: 22)
let image = NSImage(size: size)
image.lockFocus()

// Clear background
NSColor.clear.set()
NSRect(origin: .zero, size: size).fill()

// Draw 3 vertical bars (Usage bars)
NSColor.white.set()
NSRect(x: 2, y: 4, width: 4, height: 5).fill()
NSRect(x: 9, y: 4, width: 4, height: 10).fill()
NSRect(x: 16, y: 4, width: 4, height: 15).fill()

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:]) else {
    print("Error: Could not generate PNG data")
    exit(1)
}

do {
    try png.write(to: URL(fileURLWithPath: "src-tauri/resources/tray-icon.png"))
    print("SUCCESFULLY_WROTE_ICON_TO_RESOURCES")
} catch {
    print("Error writing file: \(error)")
    exit(1)
}
