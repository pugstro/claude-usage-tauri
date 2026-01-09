import Foundation
import AppKit

let size = NSSize(width: 22, height: 22)
let image = NSImage(size: size)
image.lockFocus()

// 1. Transparent background
NSColor.clear.set()
NSRect(origin: .zero, size: size).fill()

// 2. Three vertical bars (Signal/Usage style) - DEFINITELY NOT A CIRCLE
NSColor.white.set()

// Bar 1 (Short)
let b1 = NSBezierPath(roundedRect: NSRect(x: 3, y: 5, width: 4, height: 6), xRadius: 1, yRadius: 1)
b1.fill()

// Bar 2 (Medium)
let b2 = NSBezierPath(roundedRect: NSRect(x: 9, y: 5, width: 4, height: 10), xRadius: 1, yRadius: 1)
b2.fill()

// Bar 3 (Tall)
let b3 = NSBezierPath(roundedRect: NSRect(x: 15, y: 5, width: 4, height: 15), xRadius: 1, yRadius: 1)
b3.fill()

image.unlockFocus()

if let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff) {
    let png = bitmap.representation(using: .png, properties: [:])
    try? png?.write(to: URL(fileURLWithPath: "src-tauri/resources/tray-icon.png"))
}
