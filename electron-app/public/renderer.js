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
        updateCustomerDisplay();
        updateCustomerCount();
    } else {
        console.error("Failed to load customers:", response.message);
    }
}

function updateCustomerCount() {
    const countElement = document.getElementById("customerCount");
    if (countElement) {
        countElement.textContent = customers.length;
    }
}

function updateCustomerDisplay(filterText = "") {
    const customerList = document.getElementById("customerList");
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
                                <h4>Scan Results</h4>
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

window.editCustomer = function(customerId) {
    // TODO: Implement edit customer
    console.log("Edit customer:", customerId);
};

window.filterCustomers = function(filterText) {
    updateCustomerDisplay(filterText);
};

// Page loading function
async function loadPage(page) {
    const content = document.getElementById("content");
    if (!content) {
        console.error("Content element not found");
        return;
    }

    switch (page) {
    case "dashboard":
        content.innerHTML = `
                <h2>Dashboard</h2>
                <div class="row mb-3">
                    <div class="col">
                        <div class="card">
                            <div class="card-body">
                                <h5 class="card-title">Active Customers</h5>
                                <p class="card-text" id="customerCount">Loading...</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <button class="btn btn-primary" id="addCustomer">Add Customer</button>
                            <input type="text" class="form-control w-auto" id="customerSearch" placeholder="Search customers...">
                        </div>
                        <div id="customerList"></div>
                    </div>
                </div>
            `;
        await loadCustomers();
        break;
            
    case "scan":
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
            
        document.getElementById("scanForm").addEventListener("submit", async (e) => {
            e.preventDefault();
            const networkRange = document.getElementById("networkRange").value;
            const results = await ipcRenderer.invoke("start-scan", networkRange);
            document.getElementById("scanResults").innerHTML = `
                    <div class="alert alert-info">
                        Scan started for range: ${networkRange}
                    </div>
                `;
        });
        break;
            
    case "customers":
        content.innerHTML = `
                <h2>Customers</h2>
                <div class="card">
                    <div class="card-body">
                        <button class="btn btn-primary mb-3" id="addCustomer">Add Customer</button>
                        <div id="customerList"></div>
                    </div>
                </div>
            `;
        await loadCustomers();
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
            const devicesList = document.getElementById("savedDevicesList");
            devicesList.innerHTML = response.data.map(device => `
                <div class="col-md-4 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">${device.ip}</h5>
                            <p class="card-text">
                                <strong>MAC:</strong> ${device.mac}<br>
                                <strong>Last Seen:</strong> ${new Date(device.last_seen).toLocaleString()}
                            </p>
                            <button class="btn btn-danger btn-sm" onclick="deleteDevice('${device.id}')">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            `).join("");
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
                            <label for="networkRange" class="form-label">Network Range</label>
                            <input type="text" class="form-control" id="networkRange" 
                                   placeholder="e.g., 192.168.1.0/24" required>
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
    const networkRange = document.getElementById("networkRange").value;
    if (!networkRange) {
        showAlert("Please enter a network range", "warning");
        return;
    }

    const scanProgress = document.getElementById("scanProgress");
    const scanForm = document.getElementById("scanForm");
    const scanResults = document.getElementById("scanResults");
    const devicesList = document.getElementById("devicesList");
    
    // Show progress and hide form
    scanProgress.style.display = "block";
    scanForm.style.display = "none";
    
    try {
        const response = await ipcRenderer.invoke("start-scan", networkRange);
        if (response.status === "success") {
            // Hide progress and show results
            scanProgress.style.display = "none";
            scanForm.style.display = "block";
            
            // Display results
            scanResults.classList.remove("hidden");
            devicesList.innerHTML = `
                <div class="col-12 mb-3">
                    <button class="btn btn-success" onclick="saveAllDevices()">
                        <i class="fas fa-save"></i> Save All Devices
                    </button>
                </div>
                ${response.results.map(device => `
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
                `).join("")}`;
            
            // Close the modal
            bootstrap.Modal.getInstance(document.getElementById("scanModal")).hide();
        } else {
            showAlert(`Scan failed: ${response.message}`, "danger");
        }
    } catch (error) {
        showAlert(`Error scanning network: ${error.message}`, "danger");
    }
};

window.saveDevice = async function(ip, mac) {
    if (!currentCustomerId) {
        showAlert("No customer selected", "danger");
        return;
    }

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
            showAlert(`Failed to save device: ${response.message}`, "danger");
        }
    } catch (error) {
        showAlert(`Error saving device: ${error.message}`, "danger");
    }
};

window.saveAllDevices = async function() {
    if (!currentCustomerId) {
        showAlert("No customer selected", "danger");
        return;
    }

    const devices = Array.from(document.querySelectorAll("#devicesList .card")).map(card => ({
        ip: card.querySelector(".card-title").textContent,
        mac: card.querySelector(".card-text").textContent.match(/MAC:\s*([^\n]+)/)[1]
    }));

    let successCount = 0;
    let errorCount = 0;

    for (const device of devices) {
        try {
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
        } catch (error) {
            errorCount++;
        }
    }

    if (successCount > 0) {
        showAlert(`Successfully saved ${successCount} device(s)`, "success");
        loadSavedDevices(currentCustomerId);
    }
    if (errorCount > 0) {
        showAlert(`Failed to save ${errorCount} device(s)`, "warning");
    }
};

// Initialize the application
document.addEventListener("DOMContentLoaded", function() {
    loadPage("dashboard");
}); 