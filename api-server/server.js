const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { exec } = require('child_process');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: false
});

// Define models
const Customer = sequelize.define('Customer', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: DataTypes.STRING,
  contact_person: DataTypes.STRING,
  phone: DataTypes.STRING,
  email: DataTypes.STRING
});

const Device = sequelize.define('Device', {
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Unnamed Device'
  },
  ip: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mac: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  manufacturer: DataTypes.STRING,
  last_seen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  location: DataTypes.STRING,
  system: DataTypes.STRING,
  notes: DataTypes.TEXT,
  login: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

const CCTVDevice = sequelize.define('CCTVDevice', {
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ip: {
    type: DataTypes.STRING,
    allowNull: false
  },
  model: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

const Password = sequelize.define('Password', {
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  service_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  notes: DataTypes.TEXT
});

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Set up relationships
Customer.hasMany(Device, { foreignKey: 'customer_id' });
Device.belongsTo(Customer, { foreignKey: 'customer_id' });

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// API endpoints
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: user.is_admin },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Customer endpoints
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await Customer.findAll();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    await customer.update(req.body);
    res.json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Network scanning endpoints
app.post('/api/network/scan', authenticateToken, async (req, res) => {
  const { customerId } = req.body;
  try {
    // This is a placeholder for actual network scanning
    // In a real implementation, you would use a network scanning library
    const devices = [
      { ip: '192.168.1.1', mac: '00:11:22:33:44:55', manufacturer: 'TP-Link' },
      { ip: '192.168.1.2', mac: '00:11:22:33:44:56', manufacturer: 'D-Link' }
    ];
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Device endpoints
app.get('/api/devices', authenticateToken, async (req, res) => {
  try {
    const { customerId, type } = req.query;
    const devices = await Device.findAll({
      where: { customer_id: customerId, type }
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/devices', authenticateToken, async (req, res) => {
  try {
    const { customerId, customer_id, ip, mac, type, location, system, notes, login, password } = req.body;
    
    if (!ip || !mac || !type || !(customerId || customer_id)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const device = await Device.create({
      customer_id: customer_id || customerId,
      ip,
      mac,
      type,
      location: location || null,
      system: system || 'Other',
      notes: notes || null,
      login: login || null,
      password: password || null
    });

    res.status(201).json(device);
  } catch (error) {
    console.error('Error creating device:', error);
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    await device.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add PUT endpoint for updating devices
app.put('/api/devices/:id', authenticateToken, async (req, res) => {
  try {
    const device = await Device.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    await device.update(req.body);
    res.json(device);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete all devices for a customer
app.delete('/api/devices', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }
    
    await Device.destroy({
      where: { customer_id: customerId }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// CCTV endpoints
app.get('/api/cctv', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.query;
    const devices = await CCTVDevice.findAll({
      where: { customer_id: customerId }
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/cctv', authenticateToken, async (req, res) => {
  try {
    const device = await CCTVDevice.create(req.body);
    res.status(201).json(device);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/cctv/:id', authenticateToken, async (req, res) => {
  try {
    const device = await CCTVDevice.findByPk(req.params.id);
    if (!device) {
      return res.status(404).json({ message: 'CCTV device not found' });
    }
    await device.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Password endpoints
app.get('/api/passwords', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.query;
    const passwords = await Password.findAll({
      where: { customer_id: customerId }
    });
    res.json(passwords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/passwords', authenticateToken, async (req, res) => {
  try {
    const password = await Password.create(req.body);
    res.status(201).json(password);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/passwords/:id', authenticateToken, async (req, res) => {
  try {
    const password = await Password.findByPk(req.params.id);
    if (!password) {
      return res.status(404).json({ message: 'Password not found' });
    }
    await password.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 3002;

const startServer = async () => {
  try {
    // Sync database and create default admin user
    await sequelize.sync({ force: true });
    console.log('Database synchronized');

    await User.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        password_hash: bcrypt.hashSync('admin', 10),
        is_admin: true
      }
    });
    console.log('Default admin user created');

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// Start the server
startServer(); 