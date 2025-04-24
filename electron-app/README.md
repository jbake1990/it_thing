# Network Manager Desktop

A cross-platform desktop application for network management with cloud database integration.

## Features

- Local network scanning using Nmap
- Real-time host monitoring
- Cloud database synchronization
- Cross-platform support (Windows, macOS, Linux)

## Prerequisites

### Windows
1. Install [Node.js](https://nodejs.org/) (LTS version recommended)
2. Install [Nmap](https://nmap.org/download.html)
3. Add Nmap to your system PATH

### macOS
1. Install [Node.js](https://nodejs.org/) (LTS version recommended)
2. Install Nmap using Homebrew:
   ```bash
   brew install nmap
   ```

### Linux
1. Install [Node.js](https://nodejs.org/) (LTS version recommended)
2. Install Nmap using your package manager:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install nmap
   
   # Fedora
   sudo dnf install nmap
   
   # Arch Linux
   sudo pacman -S nmap
   ```

## Installation

1. Clone the repository
2. Navigate to the project directory:
   ```bash
   cd electron-app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

## Development

To start the application in development mode:
```bash
npm run dev
```

## Building

To build the application for distribution:
```bash
npm run build
```

The built applications will be available in the `dist` directory.

## Configuration

1. Launch the application
2. Go to Settings
3. Configure your API endpoint and API key
4. Save the settings

## Usage

1. **Network Scanning**
   - Navigate to the Network Scan tab
   - Enter the network range (e.g., 192.168.1.0/24)
   - Click "Start Scan"

2. **Customer Management**
   - Navigate to the Customers tab
   - Add, edit, or view customer information
   - Changes are automatically synced with the cloud database

3. **Settings**
   - Configure API endpoint and credentials
   - View application logs
   - Manage application preferences

## Troubleshooting

If you encounter issues with network scanning:
1. Ensure Nmap is properly installed and accessible from the command line
2. Check if you have the necessary permissions to perform network scans
3. Verify your network range is correctly formatted

## License

ISC 