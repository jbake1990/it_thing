from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, abort
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
import logging
from network_scanner import scan_network
import json
from flask_migrate import Migrate
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(24))

# Database configuration
database_url = os.environ.get('DATABASE_URL')
if database_url:
    # Parse the DATABASE_URL to ensure it's in the correct format
    parsed = urlparse(database_url)
    if parsed.scheme == 'postgres':
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    logger.info(f"Using PostgreSQL database: {database_url}")
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///it_management.db'
    logger.info("Using SQLite database")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
migrate = Migrate(app, db)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Initialize database
with app.app_context():
    try:
        logger.info("Creating database tables...")
        db.create_all()
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {str(e)}")
        raise

# Error handlers
@app.errorhandler(500)
def internal_error(error):
    logger.error(f"500 Error: {str(error)}")
    return render_template('500.html'), 500

@app.errorhandler(404)
def not_found_error(error):
    logger.error(f"404 Error: {str(error)}")
    return render_template('404.html'), 404

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
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
    cctv_users = db.relationship('CCTVUser', backref='customer', lazy=True)

class NetworkInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    device_name = db.Column(db.String(100), nullable=False)
    ip_address = db.Column(db.String(15), nullable=False)
    subnet_mask = db.Column(db.String(15))
    gateway = db.Column(db.String(15))
    dns_servers = db.Column(db.String(200))
    notes = db.Column(db.Text)
    mac_address = db.Column(db.String(17))
    login = db.Column(db.String(100))
    password = db.Column(db.String(100))
    system_type = db.Column(db.String(50))
    cctv_type = db.Column(db.String(50))
    cctv_manufacturer = db.Column(db.String(100))

class Credential(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    service_name = db.Column(db.String(100))
    username = db.Column(db.String(100))
    password = db.Column(db.String(200))  # Will be encrypted in production
    notes = db.Column(db.Text)

class CCTVUser(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customer.id'), nullable=False)
    username = db.Column(db.String(100), nullable=False)
    password = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

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
        logger.info(f"Login attempt for username: {username}")
        
        user = User.query.filter_by(username=username).first()
        if user:
            logger.info(f"User found: {user.username}")
            if check_password_hash(user.password_hash, password):
                logger.info("Password correct, logging in user")
                login_user(user)
                next_page = request.args.get('next')
                if next_page:
                    return redirect(next_page)
                return redirect(url_for('index'))
            else:
                logger.warning("Invalid password")
        else:
            logger.warning(f"User not found: {username}")
        
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
    check_access(customer)
    
    # Get CCTV devices
    cctv_devices = [device for device in customer.network_info if device.system_type == 'CCTV System']
    
    # Get all CCTV users for this customer
    cctv_users = CCTVUser.query.filter_by(customer_id=customer_id).all()
    
    return render_template('customer_details.html', customer=customer, cctv_devices=cctv_devices, cctv_users=cctv_users)

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
        flash('Password added successfully')
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
                return redirect(url_for('scan_network_route', customer_id=customer_id))
            
            # Format devices for display
            formatted_devices = []
            for device in devices:
                formatted_device = {
                    'ip_address': device['ip_address'],
                    'hostname': device.get('hostname', 'Unknown'),
                    'mac_address': device.get('mac_address', 'Unknown'),
                    'interface': device.get('interface', 'Unknown')
                }
                formatted_devices.append(formatted_device)
            
            # Sort devices by IP address
            formatted_devices.sort(key=lambda x: [int(i) for i in x['ip_address'].split('.')])
            
            return render_template('scan_network.html', 
                                customer_id=customer_id,
                                devices=formatted_devices)
        except Exception as e:
            flash(f'Error scanning network: {str(e)}', 'danger')
            return redirect(url_for('scan_network_route', customer_id=customer_id))
    
    return render_template('scan_network.html', customer_id=customer_id)

def check_access(customer):
    """Check if the current user has access to the customer's data."""
    if current_user.is_admin:
        return True
    # Add additional access control logic here if needed
    return True

@app.route('/customer/<int:customer_id>/add_all_network_info', methods=['POST'])
@login_required
def add_all_network_info(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    
    if not check_access(customer):
        flash('You do not have permission to access this customer.', 'error')
        return redirect(url_for('index'))
    
    try:
        devices = request.form.getlist('devices[]')
        added_count = 0
        skipped_count = 0
        
        for device_json in devices:
            try:
                device = json.loads(device_json)
                
                # Check if device already exists
                existing_device = NetworkInfo.query.filter_by(
                    customer_id=customer_id,
                    ip_address=device.get('ip_address')
                ).first()
                
                if existing_device:
                    app.logger.info(f"Skipping existing device: {device.get('ip_address')}")
                    skipped_count += 1
                    continue
                
                # Create new network info entry
                network_info = NetworkInfo(
                    customer_id=customer_id,
                    device_name=device.get('hostname', 'Unknown Device'),
                    ip_address=device.get('ip_address'),
                    mac_address=device.get('mac_address'),
                    system_type='Undefined'  # Default system type
                )
                
                db.session.add(network_info)
                added_count += 1
                
            except json.JSONDecodeError as e:
                app.logger.error(f"Error parsing device data: {e}")
                continue
            except Exception as e:
                app.logger.error(f"Error processing device: {e}")
                continue
        
        db.session.commit()
        
        if added_count > 0:
            flash(f'Successfully added {added_count} new devices.', 'success')
        if skipped_count > 0:
            flash(f'Skipped {skipped_count} existing devices.', 'info')
        if added_count == 0 and skipped_count == 0:
            flash('No new devices were added.', 'info')
            
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error adding network info: {e}")
        flash('An error occurred while adding devices.', 'error')
    
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
            network_info.system_type = request.form.get('system_type', 'Undefined')
            
            # Handle CCTV specific fields
            if network_info.system_type == 'CCTV System':
                network_info.cctv_type = request.form.get('cctv_type')
                network_info.cctv_manufacturer = request.form.get('cctv_manufacturer')
            else:
                # Clear CCTV fields if system type is not CCTV
                network_info.cctv_type = None
                network_info.cctv_manufacturer = None
            
            db.session.commit()
            flash('Network information updated successfully!', 'success')
            return redirect(url_for('customer_details', customer_id=customer_id))
        except Exception as e:
            db.session.rollback()
            flash(f'Error updating network information: {str(e)}', 'error')
    
    return render_template('edit_network_info.html', 
                         customer=customer,
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
    check_access(customer)
    
    if request.method == 'POST':
        customer.name = request.form.get('name')
        customer.address = request.form.get('address')
        customer.contact_person = request.form.get('contact_person')
        customer.phone = request.form.get('phone')
        customer.email = request.form.get('email')
        
        db.session.commit()
        flash('Customer updated successfully')
        return redirect(url_for('customer_details', customer_id=customer_id))
    
    return render_template('edit_customer.html', customer=customer)

@app.route('/customer/<int:customer_id>/delete', methods=['POST'])
@login_required
def delete_customer(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    check_access(customer)
    
    try:
        # Delete all associated CCTV users first
        CCTVUser.query.filter_by(customer_id=customer_id).delete()
        
        # Delete all associated credentials
        Credential.query.filter_by(customer_id=customer_id).delete()
        
        # Delete all associated network info
        NetworkInfo.query.filter_by(customer_id=customer_id).delete()
        
        # Now delete the customer
        db.session.delete(customer)
        db.session.commit()
        
        flash('Customer and all associated data have been deleted successfully')
        return redirect(url_for('index'))
    except Exception as e:
        db.session.rollback()
        flash(f'Error deleting customer: {str(e)}', 'error')
        return redirect(url_for('customer_details', customer_id=customer_id))

@app.route('/customer/<int:customer_id>/cctv/user/add', methods=['GET', 'POST'])
@login_required
def add_cctv_user(customer_id):
    customer = Customer.query.get_or_404(customer_id)
    check_access(customer)
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            flash('Username and password are required', 'danger')
            return redirect(url_for('add_cctv_user', customer_id=customer_id))
        
        user = CCTVUser(
            customer_id=customer_id,
            username=username,
            password=password
        )
        
        db.session.add(user)
        db.session.commit()
        
        flash('CCTV user added successfully', 'success')
        return redirect(url_for('customer_details', customer_id=customer_id))
    
    return render_template('add_cctv_user.html', customer=customer)

@app.route('/customer/<int:customer_id>/cctv/user/<int:user_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_cctv_user(customer_id, user_id):
    customer = Customer.query.get_or_404(customer_id)
    check_access(customer)
    
    user = CCTVUser.query.filter_by(id=user_id, customer_id=customer_id).first_or_404()
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            flash('Username and password are required', 'danger')
            return redirect(url_for('edit_cctv_user', customer_id=customer_id, user_id=user_id))
        
        user.username = username
        user.password = password
        
        db.session.commit()
        
        flash('CCTV user updated successfully', 'success')
        return redirect(url_for('customer_details', customer_id=customer_id))
    
    return render_template('edit_cctv_user.html', customer=customer, user=user)

@app.route('/customer/<int:customer_id>/cctv/user/<int:user_id>/delete', methods=['POST'])
@login_required
def delete_cctv_user(customer_id, user_id):
    customer = Customer.query.get_or_404(customer_id)
    check_access(customer)
    
    user = CCTVUser.query.filter_by(id=user_id, customer_id=customer_id).first_or_404()
    
    db.session.delete(user)
    db.session.commit()
    
    flash('CCTV user deleted successfully', 'success')
    return redirect(url_for('customer_details', customer_id=customer_id))

@app.route('/customer/<int:customer_id>/credential/<int:credential_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_credential(customer_id, credential_id):
    credential = Credential.query.filter_by(id=credential_id, customer_id=customer_id).first_or_404()
    
    if request.method == 'POST':
        credential.service_name = request.form.get('service_name')
        credential.username = request.form.get('username')
        credential.password = request.form.get('password')
        credential.notes = request.form.get('notes')
        
        db.session.commit()
        flash('Password updated successfully')
        return redirect(url_for('customer_details', customer_id=customer_id))
    
    return render_template('edit_credential.html', customer_id=customer_id, credential=credential)

@app.route('/customer/<int:customer_id>/credential/<int:credential_id>/delete', methods=['POST'])
@login_required
def delete_credential(customer_id, credential_id):
    credential = Credential.query.filter_by(id=credential_id, customer_id=customer_id).first_or_404()
    
    db.session.delete(credential)
    db.session.commit()
    
    flash('Password deleted successfully')
    return redirect(url_for('customer_details', customer_id=customer_id))

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

@app.route('/health')
def health_check():
    try:
        # Test database connection
        db.session.execute('SELECT 1')
        return jsonify({
            'status': 'healthy',
            'database': 'connected'
        })
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

@app.route('/setup-admin', methods=['GET'])
def setup_admin():
    try:
        # Check if admin user already exists
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            # Create new admin user
            admin = User(
                username='admin',
                password_hash=generate_password_hash('admin123'),  # Change this password
                is_admin=True
            )
            db.session.add(admin)
            db.session.commit()
            return jsonify({
                'status': 'success',
                'message': 'Admin user created successfully!',
                'credentials': {
                    'username': 'admin',
                    'password': 'admin123'  # This is just for initial setup
                }
            })
        else:
            return jsonify({
                'status': 'info',
                'message': 'Admin user already exists.'
            })
    except Exception as e:
        logger.error(f"Error creating admin user: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/debug-admin', methods=['GET'])
def debug_admin():
    try:
        admin = User.query.filter_by(username='admin').first()
        if admin:
            return jsonify({
                'status': 'success',
                'admin_exists': True,
                'admin_details': {
                    'username': admin.username,
                    'is_admin': admin.is_admin,
                    'password_hash_length': len(admin.password_hash)
                }
            })
        else:
            return jsonify({
                'status': 'success',
                'admin_exists': False,
                'message': 'Admin user not found'
            })
    except Exception as e:
        logger.error(f"Debug error: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=8080) 