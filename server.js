const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Configure DNS fallback for MongoDB Atlas SRV lookup
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.log('DNS setServers notice:', e.message);
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas Connection
const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

function connectDB() {
  if (MONGODB_URI && !MONGODB_URI.includes('<username>')) {
    mongoose.connect(MONGODB_URI)
      .then(() => {
        isConnected = true;
        console.log('✅ Successfully connected to MongoDB Atlas (R2D Database)');
      })
      .catch((err) => {
        isConnected = false;
        console.error('⚠️ MongoDB Connection Error:', err.message);
        console.log('🔄 Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
      });
  } else {
    console.log('ℹ️ Notice: MONGODB_URI in .env contains placeholders. Please update .env with your actual connection string.');
  }
}

connectDB();

// ----------------------------------------------------
// MONGOOSE SCHEMAS & MODELS (Matching R2D Database)
// ----------------------------------------------------

// 1. Inventory Schema
const inventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true },
  category: { type: String, default: 'General' },
  quantity: { type: Number, required: true, default: 0 },
  unitPrice: { type: Number, default: 0 },
  location: { type: String, default: 'Main Warehouse' },
  status: { type: String, default: 'In Stock' }
}, { timestamps: true });

const Inventory = mongoose.model('inventory', inventorySchema, 'inventory');

// 2. Purchase Orders Schema
const purchaseOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true },
  supplier: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
  itemsCount: { type: Number, default: 1 },
  notes: { type: String, default: '' }
}, { timestamps: true });

const PurchaseOrder = mongoose.model('purchase_orders', purchaseOrderSchema, 'purchase_orders');

// 3. Deliveries Schema
const deliverySchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true },
  carrier: { type: String, required: true },
  destination: { type: String, required: true },
  status: { type: String, default: 'In Transit' },
  estimatedArrival: { type: String, default: 'Pending' }
}, { timestamps: true });

const Delivery = mongoose.model('deliveries', deliverySchema, 'deliveries');

// 4. Purchase Requests Schema
const purchaseRequestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  requestedBy: { type: String, required: true },
  department: { type: String, default: 'Operations' },
  priority: { type: String, default: 'Medium' },
  estimatedCost: { type: Number, default: 0 },
  status: { type: String, default: 'Under Review' }
}, { timestamps: true });

const PurchaseRequest = mongoose.model('purchase_requests', purchaseRequestSchema, 'purchase_requests');


// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// System Status Endpoint
app.get('/api/status', (req, res) => {
  res.json({
    connected: isConnected,
    dbName: 'R2D',
    uriSet: MONGODB_URI && !MONGODB_URI.includes('<username>')
  });
});

// --- INVENTORY API ---
app.get('/api/inventory', async (req, res) => {
  try {
    if (!isConnected) {
      return res.json({ success: true, data: [], dbConnected: false, message: 'URI setup required' });
    }
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.json({ success: true, data: items, dbConnected: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file with your actual MongoDB Atlas connection password first!' });
    }
    const newItem = new Inventory(req.body);
    const saved = await newItem.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'MongoDB Atlas is not connected yet.' });
    }
    await Inventory.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- PURCHASE ORDERS API ---
app.get('/api/purchase-orders', async (req, res) => {
  try {
    if (!isConnected) {
      return res.json({ success: true, data: [], dbConnected: false });
    }
    const orders = await PurchaseOrder.find().sort({ createdAt: -1 });
    res.json({ success: true, data: orders, dbConnected: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/purchase-orders', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file with your actual MongoDB Atlas connection password first!' });
    }
    const newOrder = new PurchaseOrder(req.body);
    const saved = await newOrder.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/purchase-orders/:id', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'MongoDB Atlas is not connected yet.' });
    }
    await PurchaseOrder.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- DELIVERIES API ---
app.get('/api/deliveries', async (req, res) => {
  try {
    if (!isConnected) {
      return res.json({ success: true, data: [], dbConnected: false });
    }
    const deliveries = await Delivery.find().sort({ createdAt: -1 });
    res.json({ success: true, data: deliveries, dbConnected: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/deliveries', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file with your actual MongoDB Atlas connection password first!' });
    }
    const newDelivery = new Delivery(req.body);
    const saved = await newDelivery.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/deliveries/:id', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'MongoDB Atlas is not connected yet.' });
    }
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Delivery deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- PURCHASE REQUESTS API ---
app.get('/api/purchase-requests', async (req, res) => {
  try {
    if (!isConnected) {
      return res.json({ success: true, data: [], dbConnected: false });
    }
    const requests = await PurchaseRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, data: requests, dbConnected: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/purchase-requests', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file with your actual MongoDB Atlas connection password first!' });
    }
    const newRequest = new PurchaseRequest(req.body);
    const saved = await newRequest.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/purchase-requests/:id', async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'MongoDB Atlas is not connected yet.' });
    }
    await PurchaseRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Request deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
