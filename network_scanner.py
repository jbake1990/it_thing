import socket
import struct
import threading
import time
from scapy.all import ARP, Ether, srp, conf
import netifaces
import logging
import subprocess

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_network_interfaces():
    """Get all available network interfaces with IPv4 addresses."""
    interfaces = []
    for interface in netifaces.interfaces():
        try:
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr in addrs[netifaces.AF_INET]:
                    ip = addr['addr']
                    if not ip.startswith('127.'):  # Skip localhost
                        interfaces.append((interface, ip))
                        logger.info(f"Found interface {interface} with IP {ip}")
        except Exception as e:
            logger.error(f"Error getting addresses for interface {interface}: {str(e)}")
    return interfaces

def get_local_ip():
    """Get the local IP address of the machine."""
    try:
        # Try to get the default gateway first
        gateways = netifaces.gateways()
        if 'default' in gateways and netifaces.AF_INET in gateways['default']:
            default_gateway = gateways['default'][netifaces.AF_INET][1]
            logger.info(f"Default gateway: {default_gateway}")
            
            # Get the IP address of the interface that has the default gateway
            for interface, addrs in netifaces.ifaddresses(default_gateway).items():
                if netifaces.AF_INET in addrs:
                    ip = addrs[netifaces.AF_INET]['addr']
                    logger.info(f"Found IP {ip} on interface {interface}")
                    return ip
        
        # If no default gateway, try to get the first non-localhost IPv4 address
        interfaces = get_network_interfaces()
        if interfaces:
            return interfaces[0][1]
            
        # Fallback method
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            local_ip = s.getsockname()[0]
            logger.info(f"Fallback IP method found: {local_ip}")
        except Exception as e:
            logger.error(f"Fallback IP method failed: {str(e)}")
            local_ip = '127.0.0.1'
        finally:
            s.close()
        return local_ip
    except Exception as e:
        logger.error(f"Error in get_local_ip: {str(e)}")
        return '127.0.0.1'

def get_network_range(ip):
    """Convert IP address to network range (e.g., 192.168.1.1 -> 192.168.1.0/24)"""
    try:
        ip_parts = ip.split('.')
        network = f"{ip_parts[0]}.{ip_parts[1]}.{ip_parts[2]}.0/24"
        logger.info(f"Network range: {network}")
        return network
    except Exception as e:
        logger.error(f"Error in get_network_range: {str(e)}")
        return None

def scan_network():
    """Scan the local network for active devices."""
    try:
        # Get all available interfaces
        interfaces = get_network_interfaces()
        if not interfaces:
            logger.error("No network interfaces found with IPv4 addresses")
            return []
            
        all_devices = []
        
        # Scan each interface
        for interface, ip in interfaces:
            logger.info(f"Scanning interface {interface} with IP {ip}")
            
            network = get_network_range(ip)
            if not network:
                continue
                
            # Create ARP request packet
            arp = ARP(pdst=network)
            ether = Ether(dst="ff:ff:ff:ff:ff:ff")
            packet = ether/arp

            logger.info(f"Sending ARP request to {network}")
            try:
                # Send packet and capture responses
                result = srp(packet, timeout=3, verbose=0)[0]
                logger.info(f"Found {len(result)} devices on {network}")
                
                # Process results
                for sent, received in result:
                    try:
                        hostname = socket.gethostbyaddr(received.psrc)[0]
                        logger.info(f"Found device: {received.psrc} ({hostname})")
                    except:
                        hostname = "Unknown"
                        logger.info(f"Found device: {received.psrc} (hostname unknown)")
                        
                    device = {
                        'ip_address': received.psrc,
                        'mac_address': received.hwsrc,
                        'hostname': hostname,
                        'interface': interface
                    }
                    all_devices.append(device)
            except Exception as e:
                logger.error(f"Error scanning network {network}: {str(e)}")
                continue
        
        return all_devices
    except Exception as e:
        logger.error(f"Error during network scan: {str(e)}")
        return [] 