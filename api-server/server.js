const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

const NetworkInfo = sequelize.define('NetworkInfo', {
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  device_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subnet_mask: DataTypes.STRING,
  gateway: DataTypes.STRING,
  dns_servers: DataTypes.STRING,
  notes: DataTypes.TEXT,
  mac_address: DataTypes.STRING,
  login: DataTypes.STRING,
  password: DataTypes.STRING,
  system_type: DataTypes.STRING,
  cctv_type: DataTypes.STRING,
  cctv_manufacturer: DataTypes.STRING
});

const Credential = sequelize.define('Credential', {
  customer_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  service_name: DataTypes.STRING,
  username: DataTypes.STRING,
  password: DataTypes.STRING,
  notes: DataTypes.TEXT
});

const CCTVUser = sequelize.define('CCTVUser', {
  customer_id: {
    type: DataTypes.INTEGER,
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
Customer.hasMany(NetworkInfo, { foreignKey: 'customer_id' });
Customer.hasMany(Credential, { foreignKey: 'customer_id' });
Customer.hasMany(CCTVUser, { foreignKey: 'customer_id' });
NetworkInfo.belongsTo(Customer, { foreignKey: 'customer_id' });
Credential.belongsTo(Customer, { foreignKey: 'customer_id' });
CCTVUser.belongsTo(Customer, { foreignKey: 'customer_id' });

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
app.post('/auth/login', async (req, res) => {
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

// Customer endpoints
app.get('/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await Customer.findAll({
      include: [NetworkInfo, Credential, CCTVUser]
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/customers', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [NetworkInfo, Credential, CCTVUser]
    });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Initialize database and start server
const PORT = process.env.PORT || 3000;

sequelize.sync().then(() => {
  // Create default admin user if it doesn't exist
  User.findOrCreate({
    where: { username: 'admin' },
    defaults: {
      password_hash: bcrypt.hashSync('admin', 10),
      is_admin: true
    }
  }).then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  });
}); 