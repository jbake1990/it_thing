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
            // If no IP range provided, try to detect local network
            if (!ipRange) {
                ipRange = await this.detectLocalNetwork();
            }

            // Parse IP range
            const [baseIp, cidr] = ipRange.split('/');
            const subnetMask = this.cidrToSubnetMask(parseInt(cidr));
            const startIp = this.getNetworkAddress(baseIp, subnetMask);
            const endIp = this.getBroadcastAddress(baseIp, subnetMask);

            // Scan IP range
            await this.scanIpRange(startIp, endIp);

            return this.devices;
        } finally {
            this.scanning = false;
        }
    }

    async detectLocalNetwork() {
        // Get local IP using WebRTC
        const localIp = await this.getLocalIp();
        if (!localIp) {
            throw new Error('Could not detect local IP address');
        }

        // Assume /24 subnet for local networks
        return `${localIp}/24`;
    }

    async getLocalIp() {
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
        const startParts = startIp.split('.').map(Number);
        const endParts = endIp.split('.').map(Number);
        const totalIps = this.calculateTotalIps(startParts, endParts);
        let scannedIps = 0;

        for (let a = startParts[0]; a <= endParts[0]; a++) {
            for (let b = startParts[1]; b <= endParts[1]; b++) {
                for (let c = startParts[2]; c <= endParts[2]; c++) {
                    for (let d = startParts[3]; d <= endParts[3]; d++) {
                        const ip = `${a}.${b}.${c}.${d}`;
                        
                        // Skip network and broadcast addresses
                        if (d === 0 || d === 255) continue;

                        try {
                            const device = await this.scanIp(ip);
                            if (device) {
                                this.devices.push(device);
                            }
                        } catch (error) {
                            console.error(`Error scanning ${ip}:`, error);
                        }

                        scannedIps++;
                        if (this.progressCallback) {
                            this.progressCallback((scannedIps / totalIps) * 100);
                        }
                    }
                }
            }
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