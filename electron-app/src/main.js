const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const Store = require("electron-store");
const NetworkScanner = require("./networkScanner");
const axios = require("axios");

const store = new Store();
const networkScanner = new NetworkScanner();

const defaultSettings = {
    apiEndpoint: "http://localhost:3002",
    apiKey: ""
};

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    // Load the index.html file
    mainWindow.loadFile(path.join(__dirname, "../public/index.html"));
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Customer handlers
ipcMain.handle("add-customer", async (event, customerData) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.post(`${settings.apiEndpoint}/customers`, customerData, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

ipcMain.handle("update-customer", async (event, { customerId, customerData }) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.put(`${settings.apiEndpoint}/customers/${customerId}`, customerData, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

ipcMain.handle("get-customers", async () => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.get(`${settings.apiEndpoint}/customers`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Network scanning handlers
ipcMain.handle("start-scan", async (event, networkRange) => {
    try {
        const results = await networkScanner.scanNetwork(networkRange);
        return { status: "success", results };
    } catch (error) {
        return { status: "error", message: error.message };
    }
});

ipcMain.handle("get-host-details", async (event, ip) => {
    try {
        const details = await networkScanner.getHostDetails(ip);
        return { status: "success", details };
    } catch (error) {
        return { status: "error", message: error.message };
    }
});

// Settings handlers
ipcMain.handle("save-settings", async (event, settings) => {
    store.set("settings", settings);
    return { status: "success" };
});

ipcMain.handle("get-settings", async () => {
    return store.get("settings") || {};
});

// Cloud database handlers
ipcMain.handle("sync-customer", async (event, customerData) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.post(`${settings.apiEndpoint}/customers`, customerData, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.message };
    }
});

// Authentication handler
ipcMain.handle("login", async (event, credentials) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint) {
        return { status: "error", message: "API endpoint not configured" };
    }

    try {
        const response = await axios.post(`${settings.apiEndpoint}/auth/login`, credentials);
        if (response.data.token) {
            // Store the token
            store.set("settings.apiKey", response.data.token);
            return { status: "success", message: "Login successful" };
        }
        return { status: "error", message: "Invalid response from server" };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Customer details handler
ipcMain.handle("get-customer", async (event, customerId) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.get(`${settings.apiEndpoint}/customers/${customerId}`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Network devices handler
ipcMain.handle("get-devices", async (event, { customerId, type }) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.get(`${settings.apiEndpoint}/devices`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            },
            params: { customerId, type }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// CCTV devices handler
ipcMain.handle("get-cctv-devices", async (event, customerId) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.get(`${settings.apiEndpoint}/cctv-devices`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            },
            params: { customerId }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Passwords handler
ipcMain.handle("get-passwords", async (event, customerId) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.get(`${settings.apiEndpoint}/passwords`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            },
            params: { customerId }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Save device handler
ipcMain.handle("save-device", async (event, { ip, mac, type, customerId }) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.post(`${settings.apiEndpoint}/devices`, {
            ip,
            mac,
            type,
            customerId,
            name: `Device ${ip}`,
            system: "Other",
            notes: "Added from network scan"
        }, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Delete device handler
ipcMain.handle("delete-device", async (event, deviceId) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.delete(`${settings.apiEndpoint}/devices/${deviceId}`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Delete all devices handler
ipcMain.handle("delete-all-devices", async (event, customerId) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.delete(`${settings.apiEndpoint}/devices`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            },
            params: { customerId }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Update device handler
ipcMain.handle("update-device", async (event, { deviceId, name, location, system, notes }) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.put(`${settings.apiEndpoint}/devices/${deviceId}`, {
            name,
            location,
            system,
            notes
        }, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
});

// Get device handler
ipcMain.handle("get-device", async (event, deviceId) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.get(`${settings.apiEndpoint}/devices/${deviceId}`, {
            headers: {
                "Authorization": `Bearer ${settings.apiKey}`
            }
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.response?.data?.message || error.message };
    }
}); 