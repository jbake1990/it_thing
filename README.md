# Network Manager Desktop

A cross-platform desktop application for network management with cloud database integration.

## Project Structure

```
.
├── electron-app/           # Main application directory
│   ├── src/               # Source files
│   │   ├── main.js        # Main process
│   │   └── networkScanner.js  # Network scanning module
│   ├── public/            # Renderer process files
│   │   ├── index.html     # Main window
│   │   └── renderer.js    # Renderer process
│   ├── package.json       # Project configuration
│   └── README.md          # Application documentation
└── old_web_app_backup/    # Backup of the previous web application
```

## Quick Start

1. Install dependencies:
```bash
cd electron-app
npm install
```

2. Start the application:
```bash
npm run dev
```

3. Build the application:
```bash
npm run build
```

## Development

- `npm run dev` - Start the application in development mode
- `npm run build` - Build the application for distribution

## Documentation

For detailed documentation, please refer to the [electron-app/README.md](electron-app/README.md) file.

## License

ISC 