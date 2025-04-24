const nmap = require("node-nmap");
const ping = require("ping");

class NetworkScanner {
    constructor() {
        this.scanResults = [];
    }

    async scanNetwork(range) {
        return new Promise((resolve, reject) => {
            try {
                const quickscan = new nmap.QuickScan(range);
                
                quickscan.on("complete", (data) => {
                    this.scanResults = data;
                    resolve(this.processResults(data));
                });

                quickscan.on("error", (error) => {
                    reject(new Error(`Scan failed: ${error.message}`));
                });

                quickscan.startScan();
            } catch (error) {
                reject(new Error(`Failed to initialize scan: ${error.message}`));
            }
        });
    }

    processResults(results) {
        return results.map(host => ({
            ip: host.ip,
            hostname: host.hostname || "Unknown",
            mac: host.mac || "Unknown",
            openPorts: host.openPorts || [],
            os: host.os || "Unknown",
            lastSeen: new Date().toISOString()
        }));
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