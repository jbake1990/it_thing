const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');
const store = require('electron-store');

// API configuration
const API_BASE_URL = 'http://localhost:3002/api';

// Delete device handler
ipcMain.handle("delete-device", async (event, deviceId) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/devices/${deviceId}`);
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.message };
    }
});

// Delete all devices for a customer handler
ipcMain.handle("delete-all-devices", async (event, customerId) => {
    try {
        const response = await axios.delete(`${API_BASE_URL}/devices/customer/${customerId}`);
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.message };
    }
});

// Register handlers when app is ready
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Get device details
ipcMain.handle("get-device", async (event, deviceId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/devices/${deviceId}`);
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.message };
    }
});

// Update device handler
ipcMain.handle("update-device", async (event, { deviceId, name, location, system, notes, login, password }) => {
    const settings = store.get("settings");
    if (!settings.apiEndpoint || !settings.apiKey) {
        return { status: "error", message: "API settings not configured" };
    }

    try {
        const response = await axios.put(`${settings.apiEndpoint}/devices/${deviceId}`, {
            name,
            location,
            system,
            notes,
            login,
            password
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