const nmap = require("node-nmap");
const ping = require("ping");
const os = require("os");
const network = require("network");
const { exec } = require('child_process');

class NetworkScanner {
    constructor() {
        this.scanResults = [];
        this.scanTimeout = 30000; // 30 seconds timeout
    }

    async detectLocalNetwork() {
        return new Promise(async (resolve, reject) => {
            try {
                // Try multiple methods to detect the network
                const methods = [
                    this.detectViaNetworkModule.bind(this),
                    this.detectViaOsModule.bind(this),
                    this.detectViaIfconfig.bind(this)
                ];

                for (const method of methods) {
                    try {
                        const range = await method();
                        if (range) {
                            console.log(`Network detected using ${method.name}: ${range}`);
                            resolve(range);
                            return;
                        }
                    } catch (error) {
                        console.warn(`Method ${method.name} failed:`, error);
                    }
                }

                // If all methods fail, use fallback range
                console.log('All detection methods failed, using fallback range');
                resolve("192.168.1.0/24");
            } catch (error) {
                console.error('Error in detectLocalNetwork:', error);
                resolve("192.168.1.0/24");
            }
        });
    }

    async detectViaNetworkModule() {
        return new Promise((resolve, reject) => {
            network.get_gateway_ip((err, gateway) => {
                if (err) {
                    reject(err);
                    return;
                }

                const interfaces = os.networkInterfaces();
                for (const name of Object.keys(interfaces)) {
                    for (const iface of interfaces[name]) {
                        if (iface.family === 'IPv4' && !iface.internal) {
                            const ipParts = iface.address.split('.');
                            const gatewayParts = gateway.split('.');
                            
                            if (ipParts[0] === gatewayParts[0] && 
                                ipParts[1] === gatewayParts[1] && 
                                ipParts[2] === gatewayParts[2]) {
                                const cidr = this.subnetMaskToCidr(iface.netmask);
                                resolve(`${iface.address}/${cidr}`);
                                return;
                            }
                        }
                    }
                }
                reject(new Error('No matching interface found'));
            });
        });
    }

    async detectViaOsModule() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    // Check if it's a private IP address
                    const ipParts = iface.address.split('.');
                    if (ipParts[0] === '192' || ipParts[0] === '10' || 
                        (ipParts[0] === '172' && parseInt(ipParts[1]) >= 16 && parseInt(ipParts[1]) <= 31)) {
                        const cidr = this.subnetMaskToCidr(iface.netmask);
                        return `${iface.address}/${cidr}`;
                    }
                }
            }
        }
        throw new Error('No private network interface found');
    }

    async detectViaIfconfig() {
        return new Promise((resolve, reject) => {
            exec('ifconfig', (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }

                const lines = stdout.split('\n');
                let currentInterface = null;
                let ip = null;
                let netmask = null;

                for (const line of lines) {
                    if (line.includes('flags=')) {
                        currentInterface = line.split(':')[0];
                    } else if (currentInterface && line.includes('inet ')) {
                        const parts = line.trim().split(/\s+/);
                        ip = parts[1];
                        netmask = parts[3];
                        
                        // Check if it's a private IP
                        const ipParts = ip.split('.');
                        if (ipParts[0] === '192' || ipParts[0] === '10' || 
                            (ipParts[0] === '172' && parseInt(ipParts[1]) >= 16 && parseInt(ipParts[1]) <= 31)) {
                            const cidr = this.subnetMaskToCidr(netmask);
                            resolve(`${ip}/${cidr}`);
                            return;
                        }
                    }
                }
                reject(new Error('No private network found in ifconfig output'));
            });
        });
    }

    subnetMaskToCidr(subnetMask) {
        return subnetMask.split('.')
            .map(octet => (octet >>> 0).toString(2).split('1').length - 1)
            .reduce((a, b) => a + b);
    }

    async scanNetwork(range = null) {
        return new Promise(async (resolve, reject) => {
            try {
                // If no range provided, try to detect it
                if (!range) {
                    try {
                        range = await this.detectLocalNetwork();
                        console.log(`Detected network range: ${range}`);
                    } catch (error) {
                        console.warn(`Failed to detect network range: ${error.message}`);
                        // Fallback to common local network range
                        range = "192.168.1.0/24";
                        console.log(`Using fallback range: ${range}`);
                    }
                }

                // Ensure range is a string and properly formatted
                if (typeof range !== 'string') {
                    range = String(range);
                }

                // Validate the range format (should be in CIDR notation)
                if (!range.includes('/')) {
                    // If no CIDR notation, assume /24 subnet
                    const ipParts = range.split('.');
                    if (ipParts.length === 4) {
                        range = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.0/24`;
                    } else {
                        throw new Error('Invalid IP range format');
                    }
                }

                // Set up timeout
                const timeoutId = setTimeout(() => {
                    reject(new Error('Scan timed out after 30 seconds'));
                }, this.scanTimeout);

                // Create a more detailed scan configuration
                const scan = new nmap.NmapScan(range, [
                    '-sn',           // Ping scan (no port scan)
                    '-PR',           // ARP ping
                    '-n',            // No DNS resolution
                    '--send-eth',    // Send raw ethernet frames
                    '--send-ip',     // Send IP packets
                    '--min-rtt-timeout', '100ms',  // Minimum RTT timeout
                    '--max-rtt-timeout', '1000ms', // Maximum RTT timeout
                    '--initial-rtt-timeout', '500ms', // Initial RTT timeout
                    '--max-retries', '2',  // Maximum retries
                    '--host-timeout', '5s', // Host timeout
                    '--min-rate', '100',    // Minimum packet rate
                    '--max-rate', '1000',   // Maximum packet rate
                    '--packet-trace',       // Show packets sent/received
                    '--reason',             // Show reason for host state
                    '--append-output',      // Append to output file
                    '--log-errors'          // Log errors
                ]);
                
                scan.on("complete", (data) => {
                    clearTimeout(timeoutId);
                    console.log('Scan completed, found devices:', data.length);
                    this.scanResults = data;
                    resolve(this.processResults(data));
                });

                scan.on("error", (error) => {
                    clearTimeout(timeoutId);
                    console.error('Scan error:', error);
                    reject(new Error(`Scan failed: ${error.message}`));
                });

                console.log('Starting advanced scan with range:', range);
                scan.startScan();
            } catch (error) {
                console.error('Scan initialization error:', error);
                reject(new Error(`Failed to initialize scan: ${error.message}`));
            }
        });
    }

    processResults(results) {
        return results.map(host => {
            // Format MAC address if present
            let mac = "Unknown";
            if (host.mac) {
                mac = host.mac.toUpperCase();
                // Ensure MAC is in standard format (XX:XX:XX:XX:XX:XX)
                if (!mac.includes(':')) {
                    mac = mac.match(/.{1,2}/g).join(':');
                }
            } else if (host.address && host.address.mac) {
                mac = host.address.mac.toUpperCase();
                if (!mac.includes(':')) {
                    mac = mac.match(/.{1,2}/g).join(':');
                }
            }

            return {
                ip: host.ip,
                hostname: host.hostname || "Unknown",
                mac: mac,
                vendor: host.vendor || "Unknown",
                openPorts: host.openPorts || [],
                os: host.os || "Unknown",
                osDetails: host.osDetails || {},
                lastSeen: new Date().toISOString(),
                scanTime: host.scanTime || 0,
                latency: host.latency || 0,
                ttl: host.ttl || 0
            };
        });
    }

    async pingHost(ip) {
        try {
            const result = await ping.promise.probe(ip, {
                timeout: 10,
                extra: ["-c", "1"]
            });
            
            return {
                ip,
                isAlive: result.alive,
                timestamp: new Date().toISOString(),
                time: result.time || 0
            };
        } catch (error) {
            return {
                ip,
                isAlive: false,
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }

    async getHostDetails(ip) {
        try {
            const host = this.scanResults.find(h => h.ip === ip);
            if (!host) {
                return null;
            }

            const pingResult = await this.pingHost(ip);
            return {
                ...host,
                isAlive: pingResult.isAlive,
                lastPing: pingResult.timestamp,
                pingTime: pingResult.time,
                pingError: pingResult.error
            };
        } catch (error) {
            throw new Error(`Failed to get host details: ${error.message}`);
        }
    }
}

module.exports = NetworkScanner; 