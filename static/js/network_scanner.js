// Client-side network scanner
class NetworkScanner {
    constructor() {
        this.devices = [];
        this.scanning = false;
        this.progressCallback = null;
    }

    setProgressCallback(callback) {
        this.progressCallback = callback;
    }

    async scanNetwork(ipRange = null) {
        if (this.scanning) {
            throw new Error('Scan already in progress');
        }

        this.scanning = true;
        this.devices = [];

        try {
            console.log('Starting network scan...');
            console.log('IP Range provided:', ipRange);

            // If no IP range provided, try to detect local network
            if (!ipRange) {
                console.log('No IP range provided, attempting to detect local network...');
                ipRange = await this.detectLocalNetwork();
                console.log('Detected network range:', ipRange);
            }

            // Validate IP range format
            if (!this.isValidIpRange(ipRange)) {
                throw new Error('Invalid IP range format. Please use CIDR notation (e.g., 192.168.1.0/24)');
            }

            // Parse IP range
            const [baseIp, cidr] = ipRange.split('/');
            console.log('Base IP:', baseIp);
            console.log('CIDR:', cidr);

            const subnetMask = this.cidrToSubnetMask(parseInt(cidr));
            const startIp = this.getNetworkAddress(baseIp, subnetMask);
            const endIp = this.getBroadcastAddress(baseIp, subnetMask);

            console.log('Subnet Mask:', subnetMask);
            console.log('Start IP:', startIp);
            console.log('End IP:', endIp);

            // Scan IP range
            await this.scanIpRange(startIp, endIp);

            console.log('Scan completed. Found devices:', this.devices.length);
            return this.devices;
        } catch (error) {
            console.error('Error during network scan:', error);
            throw error;
        } finally {
            this.scanning = false;
        }
    }

    isValidIpRange(ipRange) {
        const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;
        if (!cidrRegex.test(ipRange)) {
            return false;
        }

        const [ip, cidr] = ipRange.split('/');
        const parts = ip.split('.');
        
        return parts.every(part => {
            const num = parseInt(part);
            return num >= 0 && num <= 255;
        });
    }

    async detectLocalNetwork() {
        console.log('Attempting to detect local network...');
        // Try multiple methods to detect local network
        const methods = [
            this.getLocalIpWebRTC.bind(this),
            this.getLocalIpWebSocket.bind(this),
            this.getLocalIpDefault.bind(this)
        ];

        for (const method of methods) {
            try {
                console.log(`Trying ${method.name}...`);
                const ip = await method();
                if (ip) {
                    console.log(`Detected local IP using ${method.name}: ${ip}`);
                    return `${ip}/24`; // Assume /24 subnet for local networks
                }
            } catch (error) {
                console.warn(`Method ${method.name} failed:`, error);
            }
        }

        throw new Error('Could not detect local network. Please specify an IP range manually.');
    }

    async getLocalIpWebRTC() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({
                iceServers: []
            });

            pc.createDataChannel('');
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
            });

            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) {
                    pc.close();
                    resolve(null);
                    return;
                }

                const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
                const match = ipRegex.exec(ice.candidate.candidate);
                if (match) {
                    pc.close();
                    resolve(match[1]);
                }
            };
        });
    }

    async getLocalIpWebSocket() {
        return new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:8080');
            ws.onopen = () => {
                const ip = ws._socket.remoteAddress;
                ws.close();
                resolve(ip);
            };
            ws.onerror = () => {
                resolve(null);
            };
        });
    }

    getLocalIpDefault() {
        // Return common local network ranges
        const commonRanges = [
            '192.168.1.1',
            '192.168.0.1',
            '10.0.0.1',
            '172.16.0.1'
        ];

        // Try to determine which range is most likely
        return new Promise((resolve) => {
            let foundIp = null;
            let remainingChecks = commonRanges.length;

            commonRanges.forEach(ip => {
                const img = new Image();
                img.onload = () => {
                    if (!foundIp) {
                        foundIp = ip;
                    }
                    remainingChecks--;
                    if (remainingChecks === 0) {
                        resolve(foundIp);
                    }
                };
                img.onerror = () => {
                    remainingChecks--;
                    if (remainingChecks === 0) {
                        resolve(foundIp);
                    }
                };
                img.src = `http://${ip}/favicon.ico?${Date.now()}`;
                setTimeout(() => {
                    img.src = '';
                }, 100);
            });
        });
    }

    cidrToSubnetMask(cidr) {
        const mask = [];
        for (let i = 0; i < 4; i++) {
            const n = Math.min(cidr, 8);
            mask.push(256 - Math.pow(2, 8 - n));
            cidr -= n;
        }
        return mask.join('.');
    }

    getNetworkAddress(ip, subnetMask) {
        const ipParts = ip.split('.').map(Number);
        const maskParts = subnetMask.split('.').map(Number);
        return ipParts.map((part, i) => part & maskParts[i]).join('.');
    }

    getBroadcastAddress(ip, subnetMask) {
        const ipParts = ip.split('.').map(Number);
        const maskParts = subnetMask.split('.').map(Number);
        return ipParts.map((part, i) => part | (~maskParts[i] & 255)).join('.');
    }

    async scanIpRange(startIp, endIp) {
        console.log('Starting IP range scan...');
        const startParts = startIp.split('.').map(Number);
        const endParts = endIp.split('.').map(Number);
        const totalIps = this.calculateTotalIps(startParts, endParts);
        let scannedIps = 0;

        console.log('Total IPs to scan:', totalIps);

        // Create an array of IPs to scan
        const ipsToScan = [];
        for (let a = startParts[0]; a <= endParts[0]; a++) {
            for (let b = startParts[1]; b <= endParts[1]; b++) {
                for (let c = startParts[2]; c <= endParts[2]; c++) {
                    for (let d = startParts[3]; d <= endParts[3]; d++) {
                        if (d === 0 || d === 255) continue; // Skip network and broadcast addresses
                        ipsToScan.push(`${a}.${b}.${c}.${d}`);
                    }
                }
            }
        }

        console.log('IPs to scan:', ipsToScan.length);

        // Scan IPs in batches to avoid overwhelming the browser
        const batchSize = 10;
        for (let i = 0; i < ipsToScan.length; i += batchSize) {
            const batch = ipsToScan.slice(i, i + batchSize);
            console.log(`Scanning batch ${i/batchSize + 1}/${Math.ceil(ipsToScan.length/batchSize)}`);
            
            await Promise.all(batch.map(async (ip) => {
                try {
                    const device = await this.scanIp(ip);
                    if (device) {
                        console.log('Found device:', device);
                        this.devices.push(device);
                    }
                } catch (error) {
                    console.error(`Error scanning ${ip}:`, error);
                }
                scannedIps++;
                if (this.progressCallback) {
                    this.progressCallback((scannedIps / totalIps) * 100);
                }
            }));
        }
    }

    calculateTotalIps(startParts, endParts) {
        return (endParts[0] - startParts[0] + 1) *
               (endParts[1] - startParts[1] + 1) *
               (endParts[2] - startParts[2] + 1) *
               (endParts[3] - endParts[3] + 1);
    }

    async scanIp(ip) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                console.log(`Device found at ${ip}`);
                resolve({
                    ip_address: ip,
                    hostname: 'Unknown',
                    mac_address: 'Unknown',
                    interface: 'Local Network'
                });
            };
            img.onerror = () => {
                resolve(null);
            };
            img.src = `http://${ip}/favicon.ico?${Date.now()}`;
            setTimeout(() => {
                img.src = '';
                resolve(null);
            }, 100);
        });
    }
}

// Export the scanner class
window.NetworkScanner = NetworkScanner; 