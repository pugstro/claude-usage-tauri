# Claude Usage - Tauri App

A lightweight desktop app (macOS/Windows) for displaying Claude Code usage limits.

Built with Tauri v2, TypeScript, and Rust.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Make sure Rust is installed (the project will use it automatically)

## Development

Run the development server:
```bash
npm run tauri dev
```

This will:
- Start the Vite dev server for the frontend
- Compile and run the Tauri app
- Open the app window

## Build

Build for production:
```bash
npm run tauri build
```

## Project Structure

- `src/` - Frontend TypeScript/HTML/CSS
- `src-tauri/` - Rust backend
  - `src/main.rs` - Entry point
  - `src/lib.rs` - Tauri commands and app setup
  - `Cargo.toml` - Rust dependencies
  - `tauri.conf.json` - Tauri configuration

## Next Steps

- [ ] Implement credential reading from Keychain (macOS) / Credential Manager (Windows)
- [ ] Add API integration with Anthropic usage endpoint
- [ ] Create system tray/menubar integration
- [ ] Build usage display UI
- [ ] Add auto-refresh functionality
