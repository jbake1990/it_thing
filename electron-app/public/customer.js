const { ipcRenderer } = require('electron');

// Get customer ID from URL
const urlParams = new URLSearchParams(window.location.search);
const customerId = urlParams.get("id");

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    loadCustomerDetails();
    loadSavedDevices();
    loadCCTVDevices();
    loadPasswords();
});

// Load customer details
async function loadCustomerDetails() {
    try {
        const response = await fetch(`http://localhost:3000/api/customers/${customerId}`);
        const customer = await response.json();
        document.getElementById("customerName").textContent = customer.name;
    } catch (error) {
        console.error("Error loading customer details:", error);
    }
}

// Network Scanning Functions
async function scanNetwork() {
    try {
        const response = await fetch("http://localhost:3000/api/network/scan", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ customerId })
        });
        const devices = await response.json();
        displayScanResults(devices);
    } catch (error) {
        console.error("Error scanning network:", error);
    }
}

function displayScanResults(devices) {
    const devicesList = document.getElementById("devicesList");
    const scanResults = document.getElementById("scanResults");
    
    devicesList.innerHTML = "";
    if (devices && devices.length > 0) {
        devices.forEach(device => {
            const deviceCard = createDeviceCard(device);
            devicesList.appendChild(deviceCard);
        });
        scanResults.classList.remove("hidden");
    } else {
        scanResults.classList.add("hidden");
    }
}

// Device Management Functions
function createDeviceCard(device) {
    const card = document.createElement("div");
    card.className = "col-md-4 device-card";
    card.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title"><strong>${device.name || 'Unnamed Device'}</strong></h5>
                <p class="card-text">
                    <strong>IP:</strong> ${device.ip}<br>
                    <strong>MAC:</strong> ${device.mac}<br>
                    <strong>Manufacturer:</strong> ${device.manufacturer || "Unknown"}
                </p>
                <button class="btn btn-primary btn-sm" onclick="saveDevice('${device.ip}', '${device.mac}')">
                    Save Device
                </button>
            </div>
        </div>
    `;
    return card;
}

async function saveDevice(ip, mac) {
    if (!customerId) {
        console.error("No customer selected");
        return;
    }

    try {
        const response = await ipcRenderer.invoke("save-device", {
            ip,
            mac,
            type: "network",
            customerId: customerId
        });

        if (response.status === "success") {
            loadSavedDevices();
        } else {
            console.error("Error saving device:", response.message);
        }
    } catch (error) {
        console.error("Error saving device:", error);
    }
}

async function loadSavedDevices() {
    try {
        const response = await fetch(`http://localhost:3000/api/devices?customerId=${customerId}&type=network`);
        const devices = await response.json();
        const devicesList = document.getElementById("savedDevicesList");
        
        devicesList.innerHTML = "";
        devices.forEach(device => {
            const deviceCard = createSavedDeviceCard(device);
            devicesList.appendChild(deviceCard);
        });
    } catch (error) {
        console.error("Error loading saved devices:", error);
    }
}

function createSavedDeviceCard(device) {
    const card = document.createElement("div");
    card.className = "col-md-4 device-card";
    card.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title"><strong>${device.name || 'Unnamed Device'}</strong></h5>
                <p class="card-text">
                    <strong>IP:</strong> ${device.ip}<br>
                    <strong>MAC:</strong> ${device.mac}<br>
                    <strong>Last Seen:</strong> ${new Date(device.lastSeen).toLocaleString()}
                </p>
                <button class="btn btn-danger btn-sm" onclick="deleteDevice('${device.id}')">
                    Delete
                </button>
            </div>
        </div>
    `;
    return card;
}

// CCTV Functions
function addCCTVDevice() {
    const modal = new bootstrap.Modal(document.getElementById("addDeviceModal"));
    modal.show();
}

async function saveCCTVDevice() {
    const form = document.getElementById("deviceForm");
    const formData = {
        customerId,
        type: document.getElementById("deviceType").value,
        ip: document.getElementById("deviceIP").value,
        model: document.getElementById("deviceModel").value,
        username: document.getElementById("deviceUsername").value,
        password: document.getElementById("devicePassword").value
    };

    try {
        const response = await fetch("http://localhost:3000/api/cctv", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });
        if (response.ok) {
            loadCCTVDevices();
            bootstrap.Modal.getInstance(document.getElementById("addDeviceModal")).hide();
            form.reset();
        }
    } catch (error) {
        console.error("Error saving CCTV device:", error);
    }
}

async function loadCCTVDevices() {
    try {
        const response = await fetch(`http://localhost:3000/api/cctv?customerId=${customerId}`);
        const devices = await response.json();
        
        const nvrList = document.getElementById("nvrList");
        const cameraList = document.getElementById("cameraList");
        
        nvrList.innerHTML = "";
        cameraList.innerHTML = "";
        
        devices.forEach(device => {
            const deviceCard = createCCTVDeviceCard(device);
            if (device.type === "nvr") {
                nvrList.appendChild(deviceCard);
            } else {
                cameraList.appendChild(deviceCard);
            }
        });
    } catch (error) {
        console.error("Error loading CCTV devices:", error);
    }
}

function createCCTVDeviceCard(device) {
    const card = document.createElement("div");
    card.className = "col-md-4 device-card";
    card.innerHTML = `