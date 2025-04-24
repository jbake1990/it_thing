const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

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

// Update device
ipcMain.handle("update-device", async (event, { deviceId, name, system, notes }) => {
    try {
        const response = await axios.put(`${API_BASE_URL}/devices/${deviceId}`, {
            name,
            system,
            notes
        });
        return { status: "success", data: response.data };
    } catch (error) {
        return { status: "error", message: error.message };
    }
}); 