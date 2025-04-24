const { ipcRenderer } = require('electron');

// Navigation handling
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = e.target.closest('.nav-link').dataset.page;
        loadPage(page);
    });
});

// Customer data management
let customers = [];

async function loadCustomers() {
    const response = await ipcRenderer.invoke('get-customers');
    if (response.status === 'success') {
        customers = response.data;
        updateCustomerDisplay();
        updateCustomerCount();
    } else {
        console.error('Failed to load customers:', response.message);
    }
}

function updateCustomerCount() {
    const countElement = document.getElementById('customerCount');
    if (countElement) {
        countElement.textContent = customers.length;
    }
}

function updateCustomerDisplay(filterText = '') {
    const customerList = document.getElementById('customerList');
    const filteredCustomers = customers.filter(customer => 
        customer.name.toLowerCase().includes(filterText.toLowerCase())
    );

    customerList.innerHTML = `
        <div class="row">
            ${filteredCustomers.map(customer => `
                <div class="col-md-4 mb-4">
                    <div class="card customer-card">
                        <div class="card-body">
                            <h5 class="card-title">${customer.name}</h5>
                            <p class="card-text">
                                <strong>Address:</strong> ${customer.address || 'N/A'}<br>
                                <strong>Phone:</strong> ${customer.phone || 'N/A'}<br>
                                <strong>Email:</strong> ${customer.email || 'N/A'}<br>
                                <strong>Last Updated:</strong> ${new Date(customer.updated_at).toLocaleDateString()}
                            </p>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-primary" onclick="viewCustomer('${customer.id}')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="editCustomer('${customer.id}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Add Customer Modal
function showAddCustomerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'addCustomerModal';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Add New Customer</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="addCustomerForm">
                        <div class="mb-3">
                            <label for="customerName" class="form-label">Name *</label>
                            <input type="text" class="form-control" id="customerName" required>
                        </div>
                        <div class="mb-3">
                            <label for="customerAddress" class="form-label">Address</label>
                            <input type="text" class="form-control" id="customerAddress">
                        </div>
                        <div class="mb-3">
                            <label for="customerPhone" class="form-label">Phone Number</label>
                            <input type="tel" class="form-control" id="customerPhone">
                        </div>
                        <div class="mb-3">
                            <label for="customerEmail" class="form-label">Email</label>
                            <input type="email" class="form-control" id="customerEmail">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="submitCustomerForm()">Add Customer</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Remove modal from DOM when hidden
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

// Customer management functions
window.addCustomer = function() {
    showAddCustomerModal();
};

window.submitCustomerForm = async function() {
    const form = document.getElementById('addCustomerForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const customerData = {
        name: document.getElementById('customerName').value,
        address: document.getElementById('customerAddress').value,
        phone: document.getElementById('customerPhone').value,
        email: document.getElementById('customerEmail').value
    };

    try {
        const response = await ipcRenderer.invoke('add-customer', customerData);
        if (response.status === 'success') {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById('addCustomerModal')).hide();
            
            // Refresh customer list
            await loadCustomers();
            
            // Show success message
            showAlert('Customer added successfully!', 'success');
        } else {
            showAlert(`Failed to add customer: ${response.message}`, 'danger');
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, 'danger');
    }
};

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const content = document.getElementById('content');
    content.insertBefore(alertDiv, content.firstChild);

    // Remove alert after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

window.viewCustomer = function(customerId) {
    // TODO: Implement view customer details
    console.log('View customer:', customerId);
};

window.editCustomer = function(customerId) {
    // TODO: Implement edit customer
    console.log('Edit customer:', customerId);
};

window.filterCustomers = function(filterText) {
    updateCustomerDisplay(filterText);
};

// Page loading function
async function loadPage(page) {
    const content = document.getElementById('content');
    
    switch(page) {
        case 'dashboard':
            content.innerHTML = `
                <div class="dashboard-container">
                    <div class="row mb-4">
                        <div class="col-md-12">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Active Customers</h5>
                                    <h2 class="card-text" id="customerCount">Loading...</h2>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row mb-4">
                        <div class="col-md-12">
                            <button class="btn btn-primary" onclick="addCustomer()">
                                <i class="fas fa-plus"></i> Add New Customer
                            </button>
                        </div>
                    </div>

                    <div class="row mb-4">
                        <div class="col-md-12">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <i class="fas fa-search"></i>
                                </span>
                                <input type="text" 
                                       class="form-control" 
                                       id="customerFilter" 
                                       placeholder="Filter customers by name..."
                                       oninput="filterCustomers(this.value)">
                            </div>
                        </div>
                    </div>

                    <div id="customerList" class="row">
                        <!-- Customer cards will be loaded here -->
                    </div>
                </div>
            `;

            // Load customers and update display
            await loadCustomers();
            break;
            
        case 'scan':
            content.innerHTML = `
                <h2>Network Scan</h2>
                <div class="card">
                    <div class="card-body">
                        <form id="scanForm">
                            <div class="mb-3">
                                <label for="networkRange" class="form-label">Network Range</label>
                                <input type="text" class="form-control" id="networkRange" placeholder="e.g., 192.168.1.0/24">
                            </div>
                            <button type="submit" class="btn btn-primary">Start Scan</button>
                        </form>
                        <div id="scanResults" class="mt-3"></div>
                    </div>
                </div>
            `;
            
            document.getElementById('scanForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const networkRange = document.getElementById('networkRange').value;
                const results = await ipcRenderer.invoke('start-scan', networkRange);
                document.getElementById('scanResults').innerHTML = `
                    <div class="alert alert-info">
                        Scan started for range: ${networkRange}
                    </div>
                `;
            });
            break;
            
        case 'customers':
            content.innerHTML = `
                <h2>Customers</h2>
                <div class="card">
                    <div class="card-body">
                        <button class="btn btn-primary mb-3" id="addCustomer">Add Customer</button>
                        <div id="customerList"></div>
                    </div>
                </div>
            `;
            break;
            
        case 'settings':
            content.innerHTML = `
                <div class="settings-section">
                    <h3>API Settings</h3>
                    <div class="mb-3">
                        <label for="apiEndpoint" class="form-label">API Endpoint</label>
                        <input type="text" class="form-control" id="apiEndpoint" value="http://localhost:3000">
                    </div>
                    <div class="mb-3">
                        <label for="username" class="form-label">Username</label>
                        <input type="text" class="form-control" id="username" value="admin">
                    </div>
                    <div class="mb-3">
                        <label for="password" class="form-label">Password</label>
                        <input type="password" class="form-control" id="password" value="admin">
                    </div>
                    <button class="btn btn-primary" onclick="login(document.getElementById('username').value, document.getElementById('password').value)">Login</button>
                </div>
            `;
            break;
    }
}

// Load dashboard by default
loadPage('dashboard');

// Login function
async function login(username, password) {
    const apiEndpoint = document.getElementById('apiEndpoint').value;
    // Save API endpoint
    await ipcRenderer.invoke('save-settings', { apiEndpoint });
    
    const response = await ipcRenderer.invoke('login', { username, password });
    if (response.status === 'success') {
        showAlert('Login successful', 'success');
        // Reload customers after successful login
        loadCustomers();
    } else {
        showAlert(response.message, 'danger');
    }
} 