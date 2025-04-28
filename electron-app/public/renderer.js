// Get ipcRenderer from Electron
const { ipcRenderer } = window.require("electron");

// Navigation handling
document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        // Get the closest nav-link element, whether clicked on the link itself or its child elements
        const navLink = e.target.closest(".nav-link");
        const page = navLink.dataset.page;
        loadPage(page);
    });
});

// Customer data management
let customers = [];

// Add this at the top of the file with other global variables
let currentCustomerId = null;

async function loadCustomers() {
    const response = await ipcRenderer.invoke("get-customers");
    if (response.status === "success") {
        customers = response.data;
        console.log("Loaded customers:", customers);
        
        // Only update the display if we're on the customers page
        const customerList = document.getElementById("customerList");
        if (customerList) {
            updateCustomerDisplay();
        }
        
        // Always update the count if we're on the dashboard
        const countElement = document.getElementById("customerCount");
        if (countElement) {
            updateCustomerCount();
        }
    } else {
        console.error("Failed to load customers:", response.message);
    }
}

function updateCustomerCount() {
    const countElement = document.getElementById("customerCount");
    if (countElement) {
        console.log("Total customers:", customers.length);
        countElement.textContent = customers.length;
    }
}

function updateCustomerDisplay(filterText = "") {
    const customerList = document.getElementById("customerList");
    if (!customerList) return; // Exit if element doesn't exist
    
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
                                <strong>Address:</strong> ${customer.address || "N/A"}<br>
                                <strong>Phone:</strong> ${customer.phone || "N/A"}<br>
                                <strong>Email:</strong> ${customer.email || "N/A"}<br>
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
            `).join("")}
        </div>
    `;
}

// Add Customer Modal
function showAddCustomerModal() {
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "addCustomerModal";
    modal.setAttribute("tabindex", "-1");
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
    modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
    });
}

// Customer management functions
window.addCustomer = function() {
    showAddCustomerModal();
};

window.submitCustomerForm = async function() {
    const form = document.getElementById("addCustomerForm");
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const customerData = {
        name: document.getElementById("customerName").value,
        address: document.getElementById("customerAddress").value,
        phone: document.getElementById("customerPhone").value,
        email: document.getElementById("customerEmail").value
    };

    try {
        const response = await ipcRenderer.invoke("add-customer", customerData);
        if (response.status === "success") {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById("addCustomerModal")).hide();
            
            // Refresh customer list
            await loadCustomers();
            
            // Show success message
            showAlert("Customer added successfully!", "success");
        } else {
            showAlert(`Failed to add customer: ${response.message}`, "danger");
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, "danger");
    }
};

function showAlert(message, type = "info") {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.setAttribute("role", "alert");
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    const content = document.getElementById("content");
    content.insertBefore(alertDiv, content.firstChild);

    // Remove alert after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

window.viewCustomer = function(customerId) {
    currentCustomerId = customerId;
    // Load the customer details page
    const content = document.getElementById("content");
    content.innerHTML = `
        <div class="container mt-4">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 id="customerName">Customer Details</h2>
                <button class="btn btn-primary" onclick="loadPage('dashboard')">Back to Dashboard</button>
            </div>

            <ul class="nav nav-tabs" id="customerTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="network-tab" data-bs-toggle="tab" data-bs-target="#network" type="button" role="tab">Network Info</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="cctv-tab" data-bs-toggle="tab" data-bs-target="#cctv" type="button" role="tab">CCTV</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="passwords-tab" data-bs-toggle="tab" data-bs-target="#passwords" type="button" role="tab">Passwords</button>
                </li>
            </ul>

            <div class="tab-content" id="customerTabContent">
                <div class="tab-pane fade show active" id="network" role="tabpanel">
                    <div class="row mb-4">
                        <div class="col-md-12">
                            <button class="btn btn-primary mb-3" onclick="scanNetwork()">Scan Network</button>
                            <div id="scanResults" class="hidden">
                                <div id="devicesList" class="row"></div>
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <h4>Saved Devices</h4>
                            <div id="savedDevicesList" class="row"></div>
                        </div>
                    </div>
                </div>

                <div class="tab-pane fade" id="cctv" role="tabpanel">
                    <div class="row mb-4">
                        <div class="col-md-12">
                            <button class="btn btn-primary mb-3" onclick="addCCTVDevice()">Add CCTV Device</button>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <h4>NVRs</h4>
                            <div id="nvrList" class="row"></div>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col-md-12">
                            <h4>Cameras</h4>
                            <div id="cameraList" class="row"></div>
                        </div>
                    </div>
                </div>

                <div class="tab-pane fade" id="passwords" role="tabpanel">
                    <div class="row mb-4">
                        <div class="col-md-12">
                            <button class="btn btn-primary mb-3" onclick="addPassword()">Add Password</button>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-12">
                            <div id="passwordsList"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load customer details and related data
    loadCustomerDetails(customerId);
    loadSavedDevices(customerId);
    loadCCTVDevices(customerId);
    loadPasswords(customerId);
};

function showEditCustomerModal(customer) {
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "editCustomerModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Edit Customer</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="editCustomerForm">
                        <div class="mb-3">
                            <label for="editCustomerName" class="form-label">Name *</label>
                            <input type="text" class="form-control" id="editCustomerName" value="${customer.name}" required>
                        </div>
                        <div class="mb-3">
                            <label for="editCustomerAddress" class="form-label">Address</label>
                            <input type="text" class="form-control" id="editCustomerAddress" value="${customer.address || ''}">
                        </div>
                        <div class="mb-3">
                            <label for="editCustomerPhone" class="form-label">Phone Number</label>
                            <input type="tel" class="form-control" id="editCustomerPhone" value="${customer.phone || ''}">
                        </div>
                        <div class="mb-3">
                            <label for="editCustomerEmail" class="form-label">Email</label>
                            <input type="email" class="form-control" id="editCustomerEmail" value="${customer.email || ''}">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="submitEditCustomerForm('${customer.id}')">Save Changes</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Remove modal from DOM when hidden
    modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
    });
}

window.editCustomer = async function(customerId) {
    try {
        const response = await ipcRenderer.invoke("get-customer", customerId);
        if (response.status === "success") {
            showEditCustomerModal(response.data);
        } else {
            showAlert(`Failed to load customer: ${response.message}`, "danger");
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, "danger");
    }
};

window.submitEditCustomerForm = async function(customerId) {
    const form = document.getElementById("editCustomerForm");
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const customerData = {
        name: document.getElementById("editCustomerName").value,
        address: document.getElementById("editCustomerAddress").value,
        phone: document.getElementById("editCustomerPhone").value,
        email: document.getElementById("editCustomerEmail").value
    };

    try {
        const response = await ipcRenderer.invoke("update-customer", { customerId, customerData });
        if (response.status === "success") {
            // Close modal
            bootstrap.Modal.getInstance(document.getElementById("editCustomerModal")).hide();
            
            // Refresh customer list
            await loadCustomers();
            
            // Show success message
            showAlert("Customer updated successfully!", "success");
        } else {
            showAlert(`Failed to update customer: ${response.message}`, "danger");
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, "danger");
    }
};

window.filterCustomers = function(filterText) {
    updateCustomerDisplay(filterText);
};

// Page loading function
async function loadPage(page) {
    const content = document.getElementById("content");
    
    // Update active nav link
    document.querySelectorAll(".nav-link").forEach(link => {
        link.classList.remove("active");
        if (link.dataset.page === page) {
            link.classList.add("active");
        }
    });

    switch (page) {
        case "dashboard":
            content.innerHTML = `
                <div class="container-fluid">
                    <h2 class="mb-4">Dashboard</h2>
                    <div class="row">
                        <!-- Active Customers Card -->
                        <div class="col-md-4 mb-4">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Active Customers</h5>
                                    <h2 class="card-text" id="customerCount">0</h2>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Customer Map Card -->
                        <div class="col-md-8 mb-4">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Customer Locations</h5>
                                    <div id="customerMap" style="height: 300px;"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Internet Speed Test Card -->
                        <div class="col-md-12 mb-4">
                            <div class="card">
                                <div class="card-body">
                                    <h5 class="card-title">Internet Speed Test</h5>
                                    <div class="text-center">
                                        <button class="btn btn-primary" onclick="runSpeedTest()">Start Speed Test</button>
                                        <div id="speedTestResults" class="mt-3">
                                            <div class="row">
                                                <div class="col-md-4">
                                                    <h6>Download Speed</h6>
                                                    <p id="downloadSpeed">-</p>
                                                </div>
                                                <div class="col-md-4">
                                                    <h6>Upload Speed</h6>
                                                    <p id="uploadSpeed">-</p>
                                                </div>
                                                <div class="col-md-4">
                                                    <h6>Ping</h6>
                                                    <p id="ping">-</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Wait for the DOM to be updated
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Load customer count
            await loadCustomers();
            
            // Initialize map
            initCustomerMap();
            break;
            
        case "customers":
            content.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2>Customers</h2>
                        <button class="btn btn-primary" onclick="addCustomer()">
                            <i class="fas fa-plus"></i> Add Customer
                        </button>
                    </div>
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="input-group">
                                <span class="input-group-text">
                                    <i class="fas fa-search"></i>
                                </span>
                                <input type="text" class="form-control" id="customerFilter" placeholder="Search customers...">
                            </div>
                        </div>
                    </div>
                    <div id="customerList"></div>
                </div>
            `;
            
            // Wait for the DOM to be updated
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Load customers and set up search
            await loadCustomers();
            document.getElementById("customerFilter").addEventListener("input", (e) => {
                updateCustomerDisplay(e.target.value);
            });
            break;
            
        case "settings":
            content.innerHTML = `
                <div class="settings-section">
                    <h3>API Settings</h3>
                    <div class="mb-3">
                        <label for="apiEndpoint" class="form-label">API Endpoint</label>
                        <input type="text" class="form-control" id="apiEndpoint" value="http://localhost:3002/api">
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

        default:
            content.innerHTML = `
                <div class="alert alert-warning">
                    Page '${page}' not found. Redirecting to dashboard...
                </div>
            `;
            setTimeout(() => loadPage("dashboard"), 2000);
            break;
    }
}

// Initialize navigation when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
    loadPage("dashboard");
    
    document.querySelectorAll(".nav-link").forEach(function(link) {
        link.addEventListener("click", function(e) {
            e.preventDefault();
            const page = e.target.getAttribute("data-page");
            if (page) {
                loadPage(page);
            }
        });
    });
});

// Login function
async function login(username, password) {
    const apiEndpoint = document.getElementById("apiEndpoint").value;
    // Save API endpoint
    await ipcRenderer.invoke("save-settings", { apiEndpoint });
    
    const response = await ipcRenderer.invoke("login", { username, password });
    if (response.status === "success") {
        showAlert("Login successful", "success");
        // Reload customers after successful login
        loadCustomers();
    } else {
        showAlert(response.message, "danger");
    }
}

async function loadCustomerDetails(customerId) {
    try {
        const response = await ipcRenderer.invoke("get-customer", customerId);
        if (response.status === "success") {
            document.getElementById("customerName").textContent = response.data.name;
        } else {
            showAlert("Failed to load customer details", "danger");
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, "danger");
    }
}

async function loadSavedDevices(customerId) {
    try {
        const response = await ipcRenderer.invoke("get-devices", { customerId, type: "network" });
        if (response.status === "success") {
            updateSavedDevices(response.data);
        }
    } catch (error) {
        showAlert(`Error loading devices: ${error.message}`, "danger");
    }
}

async function loadCCTVDevices(customerId) {
    try {
        const response = await ipcRenderer.invoke("get-cctv-devices", customerId);
        if (response.status === "success") {
            const nvrList = document.getElementById("nvrList");
            const cameraList = document.getElementById("cameraList");
            
            nvrList.innerHTML = response.data
                .filter(device => device.type === "nvr")
                .map(device => createCCTVDeviceCard(device))
                .join("");
            
            cameraList.innerHTML = response.data
                .filter(device => device.type === "camera")
                .map(device => createCCTVDeviceCard(device))
                .join("");
        }
    } catch (error) {
        showAlert(`Error loading CCTV devices: ${error.message}`, "danger");
    }
}

async function loadPasswords(customerId) {
    try {
        const response = await ipcRenderer.invoke("get-passwords", customerId);
        if (response.status === "success") {
            const passwordsList = document.getElementById("passwordsList");
            passwordsList.innerHTML = response.data.map(password => `
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title">${password.service_name}</h5>
                        <p class="card-text">
                            <strong>Username:</strong> ${password.username}<br>
                            <strong>Notes:</strong> ${password.notes || "N/A"}
                        </p>
                        <button class="btn btn-danger btn-sm" onclick="deletePassword('${password.id}')">
                            Delete
                        </button>
                    </div>
                </div>
            `).join("");
        }
    } catch (error) {
        showAlert(`Error loading passwords: ${error.message}`, "danger");
    }
}

function createCCTVDeviceCard(device) {
    return `
        <div class="col-md-4 mb-3">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">${device.model}</h5>
                    <p class="card-text">
                        <strong>IP:</strong> ${device.ip}<br>
                        <strong>Type:</strong> ${device.type.toUpperCase()}
                    </p>
                    <button class="btn btn-primary btn-sm" onclick="editCCTVDevice('${device.id}')">
                        Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCCTVDevice('${device.id}')">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `;
}

window.scanNetwork = async function() {
    // Create and show the scan modal
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "scanModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Network Scan</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="scanForm">
                        <div class="mb-3">
                            <label for="networkRange" class="form-label">Network Range (Optional)</label>
                            <input type="text" class="form-control" id="networkRange" 
                                   placeholder="e.g., 192.168.1.0/24">
                            <div class="form-text">Leave empty for automatic network detection</div>
                        </div>
                    </form>
                    <div id="scanProgress" class="mt-3" style="display: none;">
                        <div class="progress">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                 role="progressbar" style="width: 100%"></div>
                        </div>
                        <p class="text-center mt-2">Scanning network...</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="startNetworkScan()">Start Scan</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    // Remove modal from DOM when hidden
    modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
    });
};

window.startNetworkScan = async function() {
    const networkRange = document.getElementById("networkRange").value.trim();
    const scanProgress = document.getElementById("scanProgress");
    const scanForm = document.getElementById("scanForm");
    const scanResults = document.getElementById("scanResults");
    const devicesList = document.getElementById("devicesList");
    
    // Show progress and hide form
    scanProgress.style.display = "block";
    scanForm.style.display = "none";
    
    try {
        console.log('Starting network scan...');
        const response = await ipcRenderer.invoke("start-scan", networkRange || null);
        
        if (response.status === "success") {
            console.log('Scan completed successfully');
            if (response.results && response.results.length > 0) {
                // Update the UI with scan results
                updateScanResults(response.results);
                showAlert(`Found ${response.results.length} devices`, "success");
            } else {
                showAlert("No devices found in the specified range", "warning");
            }
        } else {
            console.error('Scan failed:', response.message);
            showAlert(response.message, "error");
        }
    } catch (error) {
        console.error('Scan error:', error);
        showAlert(`Scan failed: ${error.message}`, "error");
    } finally {
        scanProgress.style.display = "none";
        scanForm.style.display = "block";
    }
};

function updateScanResults(results) {
    const devicesList = document.getElementById("devicesList");
    const scanResults = document.getElementById("scanResults");
    
    // Remove hidden class to show the results
    scanResults.classList.remove("hidden");
    
    // Create the content without overwriting the entire div
    const content = `
        <h4>Scan Results</h4>
        <div class="row mb-3">
            <div class="col-12">
                <button class="btn btn-success" onclick="saveAllDevices()">
                    <i class="fas fa-save"></i> Save All Devices
                </button>
            </div>
        </div>
        <div class="row" id="devicesList">
            ${results.map(device => `
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">${device.ip}</h5>
                            <p class="card-text">
                                <strong>Hostname:</strong> ${device.hostname}<br>
                                <strong>MAC:</strong> ${device.mac}<br>
                                <strong>OS:</strong> ${device.os}<br>
                                <strong>Open Ports:</strong> ${device.openPorts.join(", ") || "None"}
                            </p>
                            <button class="btn btn-primary btn-sm" onclick="saveDevice('${device.ip}', '${device.mac}')">
                                Save Device
                            </button>
                        </div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
    
    // Update the scanResults div
    scanResults.innerHTML = content;
}

function updateSavedDevices(devices) {
    const savedDevicesList = document.getElementById("savedDevicesList");
    if (!savedDevicesList) return;

    savedDevicesList.innerHTML = `
        <div class="row mb-3">
            <div class="col-12">
                <button class="btn btn-danger" onclick="confirmDeleteAllDevices()">
                    <i class="fas fa-trash"></i> Delete All Devices
                </button>
            </div>
        </div>
        <div class="row">
            ${devices.map(device => `
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">${device.name || device.ip}</h5>
                            <p class="card-text">
                                <strong>IP:</strong> ${device.ip}<br>
                                <strong>MAC:</strong> ${device.mac}<br>
                                <strong>Type:</strong> ${device.system || 'Not Set'}<br>
                                <strong>Notes:</strong> ${device.notes || 'None'}
                            </p>
                            <div class="btn-group">
                                <button class="btn btn-primary btn-sm" onclick="editDevice('${device.id}')">
                                    <i class="fas fa-edit"></i> Edit
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="confirmDeleteDevice('${device.id}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join("")}
        </div>
    `;
}

// Add these new functions for delete functionality
window.confirmDeleteDevice = function(deviceId) {
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "deleteDeviceModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Confirm Delete</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete this device? This action cannot be undone.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" onclick="deleteDevice('${deviceId}')">Delete</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
    });
};

window.confirmDeleteAllDevices = function() {
    const modal = document.createElement("div");
    modal.className = "modal fade";
    modal.id = "deleteAllDevicesModal";
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Confirm Delete All</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Are you sure you want to delete ALL devices? This action cannot be undone.</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" class="btn btn-danger" onclick="deleteAllDevices()">Delete All</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    modal.addEventListener("hidden.bs.modal", () => {
        document.body.removeChild(modal);
    });
};

window.deleteDevice = async function(deviceId) {
    try {
        const response = await ipcRenderer.invoke("delete-device", deviceId);
        if (response.status === "success") {
            showAlert("Device deleted successfully", "success");
            const modal = document.getElementById("deleteDeviceModal");
            if (modal) {
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) {
                    modalInstance.hide();
                }
                modal.addEventListener("hidden.bs.modal", () => {
                    document.body.removeChild(modal);
                });
            }
            loadSavedDevices(currentCustomerId);
        } else {
            showAlert(`Failed to delete device: ${response.message}`, "error");
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, "error");
    }
};

window.deleteAllDevices = async function() {
    try {
        const response = await ipcRenderer.invoke("delete-all-devices", currentCustomerId);
        if (response.status === "success") {
            showAlert("All devices deleted successfully", "success");
            bootstrap.Modal.getInstance(document.getElementById("deleteAllDevicesModal")).hide();
            loadSavedDevices(currentCustomerId);
        } else {
            showAlert(`Failed to delete devices: ${response.message}`, "error");
        }
    } catch (error) {
        showAlert(`Error: ${error.message}`, "error");
    }
};

// Add these new functions for the dashboard
function initCustomerMap() {
    // Initialize the map with Leaflet
    // Coordinates for 1421 Manchester St., Decatur, IN 46733
    const defaultCenter = [40.8304, -84.9292]; // Approximate coordinates for Decatur, IN
    const map = L.map('customerMap').setView(defaultCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add customer markers
    customers.forEach(customer => {
        if (customer.address) {
            // Use OpenStreetMap's Nominatim geocoding service
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customer.address)}`)
                .then(response => response.json())
                .then(data => {
                    if (data && data.length > 0) {
                        const lat = parseFloat(data[0].lat);
                        const lon = parseFloat(data[0].lon);
                        const marker = L.marker([lat, lon]).addTo(map);
                        marker.bindPopup(`<b>${customer.name}</b><br>${customer.address}`);
                    } else {
                        // If geocoding fails, use default coordinates
                        const marker = L.marker(defaultCenter).addTo(map);
                        marker.bindPopup(`<b>${customer.name}</b><br>${customer.address}<br><small>(Approximate location)</small>`);
                    }
                })
                .catch(error => {
                    console.error('Geocoding error:', error);
                    // If geocoding fails, use default coordinates
                    const marker = L.marker(defaultCenter).addTo(map);
                    marker.bindPopup(`<b>${customer.name}</b><br>${customer.address}<br><small>(Approximate location)</small>`);
                });
        }
    });
}

async function runSpeedTest() {
    const resultsDiv = document.getElementById("speedTestResults");
    resultsDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
    
    try {
        // In a real implementation, you would use a speed test API here
        // For now, we'll simulate a test
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        document.getElementById("downloadSpeed").textContent = "100 Mbps";
        document.getElementById("uploadSpeed").textContent = "50 Mbps";
        document.getElementById("ping").textContent = "20 ms";
    } catch (error) {
        showAlert("Failed to run speed test: " + error.message, "danger");
    }
}

window.saveDevice = async function(ip, mac) {
    try {
        const response = await ipcRenderer.invoke("save-device", {
            ip,
            mac,
            type: "network",
            customerId: currentCustomerId
        });

        if (response.status === "success") {
            showAlert("Device saved successfully", "success");
            loadSavedDevices(currentCustomerId);
        } else {
            showAlert(`Failed to save device: ${response.message}`, "error");
        }
    } catch (error) {
        showAlert(`Error saving device: ${error.message}`, "error");
    }
};

window.saveAllDevices = async function() {
    const devicesList = document.getElementById("devicesList");
    const devices = Array.from(devicesList.querySelectorAll(".card")).map(card => {
        const ip = card.querySelector(".card-title").textContent;
        const mac = card.querySelector(".card-text").textContent.match(/MAC:\s*([^\n]+)/)[1].trim();
        return { ip, mac };
    });

    if (devices.length === 0) {
        showAlert("No devices to save", "warning");
        return;
    }

    try {
        let successCount = 0;
        let errorCount = 0;

        for (const device of devices) {
            const response = await ipcRenderer.invoke("save-device", {
                ip: device.ip,
                mac: device.mac,
                type: "network",
                customerId: currentCustomerId
            });

            if (response.status === "success") {
                successCount++;
            } else {
                errorCount++;
            }
        }

        if (successCount > 0) {
            showAlert(`Successfully saved ${successCount} device(s)`, "success");
            loadSavedDevices(currentCustomerId);
        }
        if (errorCount > 0) {
            showAlert(`Failed to save ${errorCount} device(s)`, "error");
        }
    } catch (error) {
        showAlert(`Error saving devices: ${error.message}`, "error");
    }
};

// Initialize the application
document.addEventListener("DOMContentLoaded", function() {
    loadPage("dashboard");
}); 