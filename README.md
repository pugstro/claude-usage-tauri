# Claude Usage

A lightweight desktop app (macOS only) for displaying Claude Code usage limits.

Built with [Tauri v2](https://tauri.app), TypeScript, and Rust.

[GitHub](https://github.com/pugstro/claude-usage-tauri) • [Author](https://pugstro.online)

## Features

- Auto-refresh functionality
- Color-coded status indicators (Green/Yellow/Red based on usage)
- Time until reset for session and weekly limits
- Multiple limit types: Session (5-hour), Weekly (7-day), and Sonnet-only
- Lightweight native performance
- Privacy-first: credentials never leave your machine
- Menubar-only app (no dock icon)

## Installation

### Download

1. Go to [Releases](https://github.com/pugstro/claude-usage-tauri/releases)
2. Download `Claude Usage_0.1.0_aarch64.dmg` (for Apple Silicon) or the appropriate build for your Mac
3. Open the DMG and drag `Claude Usage.app` to your Applications folder
4. Right-click the app → Open (first time only, to bypass macOS security)

**Note:** Since the app is not code-signed, macOS may show a security warning. This is normal for unsigned apps. Right-click → Open to bypass this.

### Requirements

- macOS 13.0 (Ventura) or later
- Apple Silicon (M1/M2/M3) or Intel Mac
- Claude Code CLI installed and logged in

## Setup

1. Install [Claude Code](https://claude.ai/code) if you haven't already:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Log in to Claude Code:
   ```bash
   claude
   ```

3. Launch Claude Usage - it will automatically read your credentials from Keychain

## How It Works

Claude Usage reads your Claude Code OAuth credentials from macOS Keychain and queries the usage API endpoint at `api.anthropic.com/api/oauth/usage`.

**Note:** This uses an undocumented API that could change at any time. The app will gracefully handle API changes but may stop working if Anthropic modifies the endpoint.

## Privacy

- Your credentials never leave your machine
- No analytics or telemetry
- No data sent anywhere except Anthropic's API
- Open source - verify the code yourself

## Development

### Prerequisites

- Node.js 18+ and npm
- Rust (install via [rustup](https://rustup.rs/))

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/pugstro/claude-usage-tauri.git
   cd claude-usage-tauri
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run tauri dev
   ```

### Build

Build for production:
```bash
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/`

## Project Structure

```
claude-usage-tauri/
├── src/              # Frontend TypeScript/HTML/CSS
│   ├── main.ts      # Main application logic
│   └── styles.css   # Styling
├── src-tauri/       # Rust backend
│   ├── src/
│   │   ├── main.rs  # Entry point
│   │   └── lib.rs   # Tauri commands and app setup
│   ├── Cargo.toml   # Rust dependencies
│   └── tauri.conf.json  # Tauri configuration
└── package.json      # Node.js dependencies
```

## Troubleshooting

### "Not logged in to Claude Code"

Run `claude` in Terminal and complete the login flow.

### "Authentication expired"

Your Claude Code session may have expired. Run `claude` again to re-authenticate.

### App doesn't appear in menubar

Check if the app is running in Activity Monitor. Try quitting and reopening.

### Usage shows wrong values

Click the refresh button in the dropdown. If still wrong, your Claude Code session may have expired - run `claude` again.

### "App is damaged" error

This is macOS Gatekeeper blocking unsigned apps. Right-click the app → Open to bypass this warning.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This is an unofficial tool not affiliated with Anthropic. It uses an undocumented API that may change without notice.

## Credits

- Built with [Tauri](https://tauri.app)
- Inspired by the Swift-based [claudecodeusage](https://github.com/richhickson/claudecodeusage) app

---

Made by [pugstro](https://pugstro.online)
