const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const dns = require('dns');

// Configure DNS fallback for local environment
if (process.env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {
    console.log('DNS setServers notice:', e.message);
  }
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serverless-friendly MongoDB Atlas Connection Handler
let connPromise = null;

async function ensureDbConnected() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI || MONGODB_URI.includes('<username>')) {
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (!connPromise) {
    connPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000
    }).then(() => {
      console.log('✅ Successfully connected to MongoDB Atlas (R2D Database)');
      return true;
    }).catch(err => {
      connPromise = null;
      console.error('⚠️ MongoDB Connection Error:', err.message);
      return false;
    });
  }

  return await connPromise;
}

// Middleware to ensure DB connection before handling API routes
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    await ensureDbConnected();
  }
  next();
});

function checkDbStatus() {
  const MONGODB_URI = process.env.MONGODB_URI;
  const isConnected = mongoose.connection.readyState === 1;
  const uriSet = Boolean(MONGODB_URI && !MONGODB_URI.includes('<username>'));
  return { isConnected, uriSet };
}

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
  status: { type: String, default: 'In Stock' },
  approvalStatus: { type: String, default: 'Pending Store Check' }
}, { timestamps: true });

const Inventory = mongoose.model('inventory', inventorySchema, 'inventory');

// 2. Purchase Orders Schema
const purchaseOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true },
  supplier: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
  itemsCount: { type: Number, default: 1 },
  notes: { type: String, default: '' },
  approvalStatus: { type: String, default: 'Pending Store Check' }
}, { timestamps: true });

const PurchaseOrder = mongoose.model('purchase_orders', purchaseOrderSchema, 'purchase_orders');

// 3. Deliveries Schema
const deliverySchema = new mongoose.Schema({
  trackingNumber: { type: String, required: true },
  carrier: { type: String, required: true },
  destination: { type: String, required: true },
  status: { type: String, default: 'In Transit' },
  estimatedArrival: { type: String, default: 'Pending' },
  approvalStatus: { type: String, default: 'Pending Store Check' }
}, { timestamps: true });

const Delivery = mongoose.model('deliveries', deliverySchema, 'deliveries');

// 4. Purchase Requests Schema
const purchaseRequestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  requestedBy: { type: String, required: true },
  department: { type: String, default: 'Operations' },
  priority: { type: String, default: 'Medium' },
  estimatedCost: { type: Number, default: 0 },
  status: { type: String, default: 'Under Review' },
  approvalStatus: { type: String, default: 'Pending Store Check' }
}, { timestamps: true });

const PurchaseRequest = mongoose.model('purchase_requests', purchaseRequestSchema, 'purchase_requests');


// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// System Status Endpoint
app.get('/api/status', (req, res) => {
  const { isConnected, uriSet } = checkDbStatus();
  res.json({
    connected: isConnected,
    dbName: 'R2D',
    uriSet: uriSet
  });
});

// --- INVENTORY API ---
app.get('/api/inventory', async (req, res) => {
  try {
    const { isConnected } = checkDbStatus();
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
    const { isConnected } = checkDbStatus();
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file or Vercel Environment Variables with your actual MongoDB Atlas connection password!' });
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
    const { isConnected } = checkDbStatus();
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
    const { isConnected } = checkDbStatus();
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
    const { isConnected } = checkDbStatus();
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file or Vercel Environment Variables with your actual MongoDB Atlas connection password!' });
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
    const { isConnected } = checkDbStatus();
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
    const { isConnected } = checkDbStatus();
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
    const { isConnected } = checkDbStatus();
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file or Vercel Environment Variables with your actual MongoDB Atlas connection password!' });
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
    const { isConnected } = checkDbStatus();
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
    const { isConnected } = checkDbStatus();
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
    const { isConnected } = checkDbStatus();
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Please update your .env file or Vercel Environment Variables with your actual MongoDB Atlas connection password!' });
    }
    const newRequest = new PurchaseRequest(req.body);
    const saved = await newRequest.save();
    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- STORE CHECK & HEAD APPROVAL WORKFLOW API ---
app.put('/api/approval/:collection/:id', async (req, res) => {
  try {
    const { isConnected } = checkDbStatus();
    if (!isConnected) {
      return res.status(400).json({ success: false, error: 'Database not connected' });
    }

    const collectionMap = {
      inventory: Inventory,
      orders: PurchaseOrder,
      'purchase-orders': PurchaseOrder,
      deliveries: Delivery,
      requests: PurchaseRequest,
      'purchase-requests': PurchaseRequest
    };

    const Model = collectionMap[req.params.collection];
    if (!Model) return res.status(400).json({ success: false, error: 'Invalid collection' });

    const updated = await Model.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: req.body.approvalStatus },
      { new: true }
    );

    res.json({ success: true, data: updated, message: `Status updated to ${req.body.approvalStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export app for serverless / platform deployments
module.exports = app;

// Start Server locally if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}
