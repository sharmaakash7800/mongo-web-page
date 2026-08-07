// App State
let activeTab = 'inventory';
let activeData = [];
let dbConnected = false;

// Dynamic API Base URL (if on GitHub Pages, default to http://localhost:3000)
const API_BASE_URL = window.location.hostname.includes('github.io') || window.location.protocol === 'file:' 
  ? 'http://localhost:3000' 
  : '';

// DOM Elements
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');
const dataTable = document.getElementById('dataTable');
const tableHeader = document.getElementById('tableHeader');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const recordCountLabel = document.getElementById('recordCountLabel');
const searchInput = document.getElementById('searchInput');

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const connectionWarning = document.getElementById('connectionWarning');

const recordModal = document.getElementById('recordModal');
const modalTitle = document.getElementById('modalTitle');
const modalFormFields = document.getElementById('modalFormFields');
const recordForm = document.getElementById('recordForm');

// Metrics Elements
const countInventory = document.getElementById('countInventory');
const countOrders = document.getElementById('countOrders');
const countDeliveries = document.getElementById('countDeliveries');
const countRequests = document.getElementById('countRequests');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  checkSystemStatus();
  loadMetrics();
  loadTabData(activeTab);

  // Auto refresh system status & metrics every 15s
  setInterval(() => {
    checkSystemStatus();
    loadMetrics();
  }, 15000);
});

// Navigation & Tab Switching
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      
      activeTab = button.getAttribute('data-tab');
      updateTabHeader();
      loadTabData(activeTab);
    });
  });

  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadMetrics();
    loadTabData(activeTab);
    showToast('Data refreshed from MongoDB Atlas', 'success');
  });

  document.getElementById('btnOpenModal').addEventListener('click', openRecordModal);
  document.getElementById('btnCloseModal').addEventListener('click', closeRecordModal);
  document.getElementById('btnCancelModal').addEventListener('click', closeRecordModal);
  
  recordForm.addEventListener('submit', handleFormSubmit);

  searchInput.addEventListener('input', (e) => {
    filterTable(e.target.value);
  });
}

function updateTabHeader() {
  const titles = {
    inventory: 'Inventory Collection',
    orders: 'Purchase Orders Collection',
    deliveries: 'Deliveries Collection',
    requests: 'Purchase Requests Collection'
  };
  pageTitle.textContent = titles[activeTab] || 'Data Explorer';
}

// ----------------------------------------------------
// SYSTEM STATUS & METRICS
// ----------------------------------------------------
async function checkSystemStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/status`);
    const data = await res.json();
    dbConnected = data.connected;

    if (data.connected) {
      statusDot.className = 'status-indicator online';
      statusText.textContent = 'MongoDB Atlas Connected';
      connectionWarning.classList.add('hidden');
    } else {
      statusDot.className = 'status-indicator offline';
      statusText.textContent = 'URI Password Required';
      connectionWarning.classList.remove('hidden');
    }
  } catch (err) {
    statusDot.className = 'status-indicator offline';
    statusText.textContent = 'Server Offline (Run npm start)';
    connectionWarning.classList.remove('hidden');
    connectionWarning.innerHTML = `
      <div class="banner-icon"><i class="fa-solid fa-circle-info"></i></div>
      <div class="banner-text">
        <strong>Backend Connection Notice:</strong> Make sure your local server is running (<code>npm start</code>) or host backend on Render.com.
      </div>
    `;
  }
}

async function loadMetrics() {
  try {
    const [inv, ord, del, req] = await Promise.all([
      fetch(`${API_BASE_URL}/api/inventory`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/purchase-orders`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/deliveries`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/purchase-requests`).then(r => r.json())
    ]);

    countInventory.textContent = inv.data ? inv.data.length : 0;
    countOrders.textContent = ord.data ? ord.data.length : 0;
    countDeliveries.textContent = del.data ? del.data.length : 0;
    countRequests.textContent = req.data ? req.data.length : 0;
  } catch (err) {
    console.error('Metrics loading error:', err);
  }
}

// ----------------------------------------------------
// LOAD TAB DATA FROM MONGODB API
// ----------------------------------------------------
async function loadTabData(tab) {
  tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-muted);">
    <i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Fetching from MongoDB Atlas...</td></tr>`;
  emptyState.classList.add('hidden');

  const endpointMap = {
    inventory: '/api/inventory',
    orders: '/api/purchase-orders',
    deliveries: '/api/deliveries',
    requests: '/api/purchase-requests'
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpointMap[tab]}`);
    const json = await res.json();

    if (json.success) {
      activeData = json.data;
      renderTable(activeData);
    } else {
      showToast(json.error || 'Failed to fetch data', 'error');
    }
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--accent-orange); padding:30px;">
      Backend server is offline. Run <code>npm start</code> locally or host backend online.</td></tr>`;
  }
}

// ----------------------------------------------------
// RENDER TABLE DYNAMICALLY
// ----------------------------------------------------
function renderTable(data) {
  searchInput.value = '';
  tableHeader.innerHTML = '';
  tableBody.innerHTML = '';

  recordCountLabel.textContent = `Showing ${data.length} records`;

  if (!data || data.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (activeTab === 'inventory') {
    tableHeader.innerHTML = `
      <tr>
        <th>Item Name</th>
        <th>Category</th>
        <th>Quantity</th>
        <th>Unit Price</th>
        <th>Location</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.itemName)}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(item.category)}</span></td>
        <td>${item.quantity} units</td>
        <td>$${Number(item.unitPrice).toFixed(2)}</td>
        <td>${escapeHtml(item.location)}</td>
        <td><span class="badge ${item.quantity > 0 ? 'badge-success' : 'badge-danger'}">${escapeHtml(item.status)}</span></td>
        <td><button class="action-btn" onclick="deleteRecord('${item._id}')" title="Delete from MongoDB"><i class="fa-solid fa-trash"></i></button></td>
      `;
      tableBody.appendChild(tr);
    });

  } else if (activeTab === 'orders') {
    tableHeader.innerHTML = `
      <tr>
        <th>Order Number</th>
        <th>Supplier</th>
        <th>Total Amount</th>
        <th>Items Count</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.orderNumber)}</strong></td>
        <td>${escapeHtml(item.supplier)}</td>
        <td>$${Number(item.totalAmount).toFixed(2)}</td>
        <td>${item.itemsCount}</td>
        <td><span class="badge ${item.status === 'Completed' ? 'badge-success' : 'badge-warning'}">${escapeHtml(item.status)}</span></td>
        <td><button class="action-btn" onclick="deleteRecord('${item._id}')" title="Delete from MongoDB"><i class="fa-solid fa-trash"></i></button></td>
      `;
      tableBody.appendChild(tr);
    });

  } else if (activeTab === 'deliveries') {
    tableHeader.innerHTML = `
      <tr>
        <th>Tracking #</th>
        <th>Carrier</th>
        <th>Destination</th>
        <th>Est. Arrival</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.trackingNumber)}</strong></td>
        <td>${escapeHtml(item.carrier)}</td>
        <td>${escapeHtml(item.destination)}</td>
        <td>${escapeHtml(item.estimatedArrival)}</td>
        <td><span class="badge badge-info">${escapeHtml(item.status)}</span></td>
        <td><button class="action-btn" onclick="deleteRecord('${item._id}')" title="Delete from MongoDB"><i class="fa-solid fa-trash"></i></button></td>
      `;
      tableBody.appendChild(tr);
    });

  } else if (activeTab === 'requests') {
    tableHeader.innerHTML = `
      <tr>
        <th>Title</th>
        <th>Requested By</th>
        <th>Department</th>
        <th>Priority</th>
        <th>Est. Cost</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    `;

    data.forEach(item => {
      const tr = document.createElement('tr');
      const priorityClass = item.priority === 'High' ? 'badge-danger' : (item.priority === 'Medium' ? 'badge-warning' : 'badge-info');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.title)}</strong></td>
        <td>${escapeHtml(item.requestedBy)}</td>
        <td>${escapeHtml(item.department)}</td>
        <td><span class="badge ${priorityClass}">${escapeHtml(item.priority)}</span></td>
        <td>$${Number(item.estimatedCost).toFixed(2)}</td>
        <td><span class="badge badge-info">${escapeHtml(item.status)}</span></td>
        <td><button class="action-btn" onclick="deleteRecord('${item._id}')" title="Delete from MongoDB"><i class="fa-solid fa-trash"></i></button></td>
      `;
      tableBody.appendChild(tr);
    });
  }
}

// Search Filter
function filterTable(query) {
  const q = query.toLowerCase().trim();
  const filtered = activeData.filter(item => {
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(q)
    );
  });
  renderTable(filtered);
  recordCountLabel.textContent = `Showing ${filtered.length} of ${activeData.length} records`;
}

// ----------------------------------------------------
// MODAL & FORM SUBMISSION (WRITE TO MONGODB)
// ----------------------------------------------------
function openRecordModal() {
  recordModal.classList.remove('hidden');
  
  if (activeTab === 'inventory') {
    modalTitle.textContent = 'Add Inventory Item';
    modalFormFields.innerHTML = `
      <div class="form-group">
        <label>Item Name *</label>
        <input type="text" name="itemName" class="form-control" placeholder="e.g. Wireless Mouse" required>
      </div>
      <div class="form-group">
        <label>Category</label>
        <input type="text" name="category" class="form-control" placeholder="Electronics, Peripherals..." value="General">
      </div>
      <div class="form-group">
        <label>Quantity *</label>
        <input type="number" name="quantity" class="form-control" value="10" required min="0">
      </div>
      <div class="form-group">
        <label>Unit Price ($)</label>
        <input type="number" step="0.01" name="unitPrice" class="form-control" value="25.00">
      </div>
      <div class="form-group">
        <label>Location</label>
        <input type="text" name="location" class="form-control" value="Main Warehouse">
      </div>
    `;
  } else if (activeTab === 'orders') {
    modalTitle.textContent = 'Add Purchase Order';
    modalFormFields.innerHTML = `
      <div class="form-group">
        <label>Order Number *</label>
        <input type="text" name="orderNumber" class="form-control" value="PO-${Math.floor(1000 + Math.random() * 9000)}" required>
      </div>
      <div class="form-group">
        <label>Supplier Name *</label>
        <input type="text" name="supplier" class="form-control" placeholder="e.g. Acme Tech Solutions" required>
      </div>
      <div class="form-group">
        <label>Total Amount ($) *</label>
        <input type="number" step="0.01" name="totalAmount" class="form-control" value="150.00" required>
      </div>
      <div class="form-group">
        <label>Items Count</label>
        <input type="number" name="itemsCount" class="form-control" value="5">
      </div>
      <div class="form-group">
        <label>Status</label>
        <select name="status" class="form-control">
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Completed">Completed</option>
        </select>
      </div>
    `;
  } else if (activeTab === 'deliveries') {
    modalTitle.textContent = 'Add Delivery Tracking';
    modalFormFields.innerHTML = `
      <div class="form-group">
        <label>Tracking Number *</label>
        <input type="text" name="trackingNumber" class="form-control" value="TRK-${Math.floor(100000 + Math.random() * 900000)}" required>
      </div>
      <div class="form-group">
        <label>Carrier *</label>
        <input type="text" name="carrier" class="form-control" placeholder="FedEx, DHL, UPS..." required>
      </div>
      <div class="form-group">
        <label>Destination *</label>
        <input type="text" name="destination" class="form-control" placeholder="City or Warehouse Code" required>
      </div>
      <div class="form-group">
        <label>Status</label>
        <select name="status" class="form-control">
          <option value="In Transit">In Transit</option>
          <option value="Out for Delivery">Out for Delivery</option>
          <option value="Delivered">Delivered</option>
        </select>
      </div>
      <div class="form-group">
        <label>Estimated Arrival</label>
        <input type="text" name="estimatedArrival" class="form-control" value="Tomorrow, 5:00 PM">
      </div>
    `;
  } else if (activeTab === 'requests') {
    modalTitle.textContent = 'Add Purchase Request';
    modalFormFields.innerHTML = `
      <div class="form-group">
        <label>Request Title *</label>
        <input type="text" name="title" class="form-control" placeholder="e.g. New Monitors for Dev Team" required>
      </div>
      <div class="form-group">
        <label>Requested By *</label>
        <input type="text" name="requestedBy" class="form-control" placeholder="Employee Name" required>
      </div>
      <div class="form-group">
        <label>Department</label>
        <input type="text" name="department" class="form-control" value="Engineering">
      </div>
      <div class="form-group">
        <label>Priority</label>
        <select name="priority" class="form-control">
          <option value="Low">Low</option>
          <option value="Medium" selected>Medium</option>
          <option value="High">High</option>
        </select>
      </div>
      <div class="form-group">
        <label>Estimated Cost ($)</label>
        <input type="number" step="0.01" name="estimatedCost" class="form-control" value="300.00">
      </div>
    `;
  }
}

function closeRecordModal() {
  recordModal.classList.add('hidden');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const formData = new FormData(recordForm);
  const payload = {};
  formData.forEach((val, key) => payload[key] = val);

  const endpointMap = {
    inventory: '/api/inventory',
    orders: '/api/purchase-orders',
    deliveries: '/api/deliveries',
    requests: '/api/purchase-requests'
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpointMap[activeTab]}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.success) {
      closeRecordModal();
      showToast('Saved successfully to MongoDB Atlas!', 'success');
      loadMetrics();
      loadTabData(activeTab);
    } else {
      showToast(result.error || 'Failed to save record', 'error');
    }
  } catch (err) {
    showToast('Network error saving to MongoDB', 'error');
  }
}

// ----------------------------------------------------
// DELETE RECORD FROM MONGODB
// ----------------------------------------------------
async function deleteRecord(id) {
  if (!confirm('Are you sure you want to delete this record from MongoDB?')) return;

  const endpointMap = {
    inventory: '/api/inventory',
    orders: '/api/purchase-orders',
    deliveries: '/api/deliveries',
    requests: '/api/purchase-requests'
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpointMap[activeTab]}/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      showToast('Record deleted from MongoDB', 'success');
      loadMetrics();
      loadTabData(activeTab);
    } else {
      showToast(result.error || 'Failed to delete record', 'error');
    }
  } catch (err) {
    showToast('Error deleting record', 'error');
  }
}

// ----------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------
function toggleSetupModal(show) {
  const modal = document.getElementById('setupModal');
  if (show) modal.classList.remove('hidden');
  else modal.classList.add('hidden');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  toastMessage.textContent = message;
  toastIcon.className = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation';
  toastIcon.style.color = type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)';
  
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
