from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
from network_scanner import scan_network
import json

app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///it_management.db'
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)

class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    contact_person = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    network_info = db.relationship('NetworkInfo', backref='customer', lazy=True)
    credentials = db.relationship('Credential', backref='customer', lazy=True)

class NetworkInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    device_name = db.Column(db.String(100))
    ip_address = db.Column(db.String(15))
    subnet_mask = db.Column(db.String(15))
    gateway = db.Column(db.String(15))
    dns_servers = db.Column(db.String(200))
    notes = db.Column(db.Text)
    mac_address = db.Column(db.String(17))
    login = db.Column(db.String(100))
    password = db.Column(db.String(100))

class Credential(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    service_name = db.Column(db.String(100))
    username = db.Column(db.String(100))
    password = db.Column(db.String(200))  # Will be encrypted in production
    notes = db.Column(db.Text)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Routes
@app.route('/')
@login_required
def index():
    customers = Customer.query.all()
    return render_template('index.html', customers=customers)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return redirect(url_for('index'))
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/customer/add', methods=['GET', 'POST'])
@login_required
def add_customer():
    if request.method == 'POST':
        customer = Customer(
            name=request.form.get('name'),
            address=request.form.get('address'),
            contact_person=request.form.get('contact_person'),
            phone=request.form.get('phone'),
            email=request.form.get('email')
        )
        db.session.add(customer)
        db.session.commit()
        flash('Customer added successfully')
        return redirect(url_for('index'))
    return render_template('add_customer.html')

@app.route('/customer/<int:customer_id>')
@login_required
def customer_details(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    return render_template('customer_details.html', customer=customer)

@app.route('/customer/<int:customer_id>/network/add', methods=['GET', 'POST'])
@login_required
def add_network_info(customer_id):
    if request.method == 'POST':
        network_info = NetworkInfo(
            customer_id=customer_id,
            device_name=request.form.get('device_name'),
            ip_address=request.form.get('ip_address'),
            subnet_mask=request.form.get('subnet_mask'),
            gateway=request.form.get('gateway'),
            dns_servers=request.form.get('dns_servers'),
            notes=request.form.get('notes')
        )
        db.session.add(network_info)
        db.session.commit()
        flash('Network information added successfully')
        return redirect(url_for('customer_details', customer_id=customer_id))
    return render_template('add_network_info.html', customer_id=customer_id)

@app.route('/customer/<int:customer_id>/credential/add', methods=['GET', 'POST'])
@login_required
def add_credential(customer_id):
    if request.method == 'POST':
        credential = Credential(
            customer_id=customer_id,
            service_name=request.form.get('service_name'),
            username=request.form.get('username'),
            password=request.form.get('password'),
            notes=request.form.get('notes')
        )
        db.session.add(credential)
        db.session.commit()
        flash('Credential added successfully')
        return redirect(url_for('customer_details', customer_id=customer_id))
    return render_template('add_credential.html', customer_id=customer_id)

@app.route('/scan-network/<int:customer_id>', methods=['GET', 'POST'])
def scan_network_route(customer_id):
    if request.method == 'POST':
        try:
            # Use the original network_scanner.py implementation
            from network_scanner import scan_network
            devices = scan_network()
            
            if not devices:
                flash('No devices found on the network.', 'warning')
                return redirect(url_for('scan_network', customer_id=customer_id))
            
            # Sort devices by IP address
            devices.sort(key=lambda x: [int(i) for i in x['ip_address'].split('.')])
            
            return render_template('scan_network.html', 
                                customer_id=customer_id,
                                devices=devices)
        except Exception as e:
            flash(f'Error scanning network: {str(e)}', 'danger')
            return redirect(url_for('scan_network', customer_id=customer_id))
    
    return render_template('scan_network.html', customer_id=customer_id)

@app.route('/customer/<int:customer_id>/add-all-network-info', methods=['POST'])
@login_required
def add_all_network_info(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    
    try:
        # Get the devices from the form
        devices = request.form.getlist('devices[]')
        added_count = 0
        
        for device_json in devices:
            device = json.loads(device_json)
            
            # Check if this device already exists
            existing = NetworkInfo.query.filter_by(
                customer_id=customer_id,
                ip_address=device['ip_address']
            ).first()
            
            if not existing:
                # Create new network info entry
                network_info = NetworkInfo(
                    customer_id=customer_id,
                    device_name=device['hostname'] or f"Device {device['ip_address']}",
                    ip_address=device['ip_address'],
                    mac_address=device['mac_address'],
                    notes=""  # Leave notes blank by default
                )
                db.session.add(network_info)
                added_count += 1
        
        db.session.commit()
        flash(f'Successfully added {added_count} devices to network information.', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error adding devices: {str(e)}', 'error')
    
    return redirect(url_for('customer_details', customer_id=customer_id))

@app.route('/customer/<int:customer_id>/network/<int:network_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_network_info(customer_id, network_id):
    customer = Customer.query.get_or_404(customer_id)
    network_info = NetworkInfo.query.get_or_404(network_id)
    
    # Ensure the network info belongs to the customer
    if network_info.customer_id != customer_id:
        flash('Network information not found for this customer.', 'error')
        return redirect(url_for('customer_details', customer_id=customer_id))
    
    if request.method == 'POST':
        try:
            network_info.device_name = request.form.get('device_name')
            network_info.ip_address = request.form.get('ip_address')
            network_info.subnet_mask = request.form.get('subnet_mask')
            network_info.gateway = request.form.get('gateway')
            network_info.dns_servers = request.form.get('dns_servers')
            network_info.notes = request.form.get('notes')
            network_info.login = request.form.get('login')
            network_info.password = request.form.get('password')
            
            db.session.commit()
            flash('Network information updated successfully!', 'success')
            return redirect(url_for('customer_details', customer_id=customer_id))
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating network information: {str(e)}', 'error')
    
    return render_template('edit_network_info.html', 
                         customer_id=customer_id, 
                         network_info=network_info)

@app.route('/customer/<int:customer_id>/network/<int:network_id>/delete', methods=['POST'])
@login_required
def delete_network_info(customer_id, network_id):
    customer = Customer.query.get_or_404(customer_id)
    network_info = NetworkInfo.query.get_or_404(network_id)
    
    # Ensure the network info belongs to the customer
    if network_info.customer_id != customer_id:
        flash('Network information not found for this customer.', 'error')
        return redirect(url_for('customer_details', customer_id=customer_id))
    
    try:
        db.session.delete(network_info)
        db.session.commit()
        flash('Network device deleted successfully!', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting network device: {str(e)}', 'error')
    
    return redirect(url_for('customer_details', customer_id=customer_id))

@app.route('/get-network-info')
@login_required
def get_network_info():
    try:
        # Get the local IP address and subnet
        import socket
        import netifaces
        
        # Get the default gateway interface
        gateways = netifaces.gateways()
        default_gateway = gateways['default'][netifaces.AF_INET]
        interface = default_gateway[1]
        
        # Get IP address and subnet mask
        addrs = netifaces.ifaddresses(interface)
        ip_info = addrs[netifaces.AF_INET][0]
        ip = ip_info['addr']
        subnet = ip_info['netmask']
        
        # Convert subnet mask to CIDR notation
        cidr = sum(bin(int(x)).count('1') for x in subnet.split('.'))
        
        return jsonify({
            'ip': ip,
            'subnet': cidr,
            'interface': interface
        })
    except Exception as e:
        return jsonify({
            'error': f'Error getting network information: {str(e)}'
        }), 500

@app.route('/scan-network')
@login_required
def scan_network_api():
    try:
        # Get parameters from query string
        ip_range = request.args.get('ip_range', '')
        ports_str = request.args.get('ports', '')
        
        # Parse ports
        port_list = []
        if ports_str and ports_str.strip():
            # Split by comma and filter out empty strings
            port_parts = [p.strip() for p in ports_str.split(',') if p.strip()]
            
            # Convert each part to an integer
            for part in port_parts:
                try:
                    port_list.append(int(part))
                except ValueError:
                    # Skip invalid port numbers
                    continue
        
        # Scan the network
        devices = scan_network(ip_range, port_list)
        
        return jsonify({
            'devices': devices
        })
    except ValueError as e:
        return jsonify({
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'error': f'Error scanning network: {str(e)}'
        }), 500

@app.route('/scan-network/<ip_range>/<ports>')
@login_required
def scan_network_path_params(ip_range, ports):
    try:
        # Parse ports
        port_list = []
        if ports and ports.strip():
            # Split by comma and filter out empty strings
            port_parts = [p.strip() for p in ports.split(',') if p.strip()]
            
            # Convert each part to an integer
            for part in port_parts:
                try:
                    port_list.append(int(part))
                except ValueError:
                    # Skip invalid port numbers
                    continue
        
        # Scan the network
        devices = scan_network(ip_range, port_list)
        
        return jsonify({
            'devices': devices
        })
    except ValueError as e:
        return jsonify({
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'error': f'Error scanning network: {str(e)}'
        }), 500

@app.route('/customer/<int:customer_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    
    if request.method == 'POST':
        try:
            customer.name = request.form.get('name')
            customer.address = request.form.get('address')
            customer.contact_person = request.form.get('contact_person')
            customer.phone = request.form.get('phone')
            customer.email = request.form.get('email')
            
            db.session.commit()
            flash('Customer information updated successfully!', 'success')
            return redirect(url_for('customer_details', customer_id=customer_id))
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating customer information: {str(e)}', 'error')
    
    return render_template('edit_customer.html', customer=customer)

def scan_network(ip_range=None, ports=None):
    """
    Scan the network for devices.
    
    Args:
        ip_range (str): IP range in CIDR notation (e.g., '192.168.1.0/24')
        ports (list): List of ports to scan
        
    Returns:
        list: List of devices found
    """
    import socket
    import struct
    import threading
    import time
    
    devices = []
    
    # Default to common ports if none specified
    if not ports:
        ports = [21, 22, 23, 25, 53, 80, 110, 139, 143, 443, 445, 3306, 3389, 5432, 8080]
    
    # If no IP range specified, try to detect it
    if not ip_range:
        try:
            import netifaces
            gateways = netifaces.gateways()
            default_gateway = gateways['default'][netifaces.AF_INET]
            interface = default_gateway[1]
            
            addrs = netifaces.ifaddresses(interface)
            ip_info = addrs[netifaces.AF_INET][0]
            ip = ip_info['addr']
            subnet = ip_info['netmask']
            
            # Convert to CIDR notation
            cidr = sum(bin(int(x)).count('1') for x in subnet.split('.'))
            ip_range = f"{ip}/{cidr}"
        except Exception as e:
            print(f"Error detecting IP range: {e}")
            # Fallback to a common range
            ip_range = "192.168.1.0/24"
    
    # Parse IP range
    try:
        # Handle different IP range formats
        if '/' in ip_range:
            # CIDR notation (e.g., 192.168.1.0/24)
            ip_parts = ip_range.split('/')
            if len(ip_parts) != 2:
                raise ValueError("Invalid IP range format. Use CIDR notation (e.g., 192.168.1.0/24)")
            
            network = ip_parts[0]
            bits = int(ip_parts[1])
            
            # Convert IP to integer
            ip_int = struct.unpack('!L', socket.inet_aton(network))[0]
            
            # Calculate network and broadcast addresses
            mask = ~((1 << (32 - bits)) - 1) & 0xFFFFFFFF
            network_int = ip_int & mask
            broadcast_int = network_int | ~mask & 0xFFFFFFFF
        else:
            # Single IP or range (e.g., 192.168.1.1-192.168.1.254)
            if '-' in ip_range:
                start_ip, end_ip = ip_range.split('-')
                network_int = struct.unpack('!L', socket.inet_aton(start_ip.strip()))[0]
                broadcast_int = struct.unpack('!L', socket.inet_aton(end_ip.strip()))[0]
            else:
                # Single IP
                ip_int = struct.unpack('!L', socket.inet_aton(ip_range.strip()))[0]
                network_int = ip_int
                broadcast_int = ip_int
        
        # Convert back to string for logging
        network_str = socket.inet_ntoa(struct.pack('!L', network_int))
        broadcast_str = socket.inet_ntoa(struct.pack('!L', broadcast_int))
        
        print(f"Scanning network {network_str} to {broadcast_str}")
        
        # Function to scan a single IP
        def scan_ip(ip):
            ip_str = socket.inet_ntoa(struct.pack('!L', ip))
            
            # Try to get hostname
            try:
                hostname = socket.gethostbyaddr(ip_str)[0]
            except:
                hostname = None
            
            # Check if any ports are open
            open_ports = []
            for port in ports:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.1)
                result = sock.connect_ex((ip_str, port))
                if result == 0:
                    open_ports.append(port)
                sock.close()
            
            if hostname or open_ports:
                devices.append({
                    'ip': ip_str,
                    'hostname': hostname,
                    'ports': open_ports
                })
        
        # Create threads for scanning
        threads = []
        for i in range(network_int + 1, broadcast_int):
            t = threading.Thread(target=scan_ip, args=(i,))
            threads.append(t)
            t.start()
            
            # Limit concurrent threads
            if len(threads) >= 100:
                for t in threads:
                    t.join()
                threads = []
        
        # Wait for remaining threads
        for t in threads:
            t.join()
        
    except Exception as e:
        print(f"Error scanning network: {e}")
        # Return a more helpful error message
        raise ValueError(f"Error scanning network: {str(e)}")
    
    return devices

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True) 