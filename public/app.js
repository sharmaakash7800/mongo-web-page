// App State
let activeTab = 'inventory';
let activeData = [];
let dbConnected = false;
let customApiUrl = localStorage.getItem('custom_api_url') || '';
let resolvedApiUrl = customApiUrl;
let currentTheme = localStorage.getItem('theme') || 'dark';
let currentUserRole = localStorage.getItem('user_role') || 'Admin';

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
const statusSub = document.getElementById('statusSub');
const connectionWarning = document.getElementById('connectionWarning');
const warningBannerText = document.getElementById('warningBannerText');

const recordModal = document.getElementById('recordModal');
const modalTitle = document.getElementById('modalTitle');
const modalFormFields = document.getElementById('modalFormFields');
const recordForm = document.getElementById('recordForm');

const serverModal = document.getElementById('serverModal');
const inputServerUrl = document.getElementById('inputServerUrl');

// Metrics Elements
const countInventory = document.getElementById('countInventory');
const countOrders = document.getElementById('countOrders');
const countDeliveries = document.getElementById('countDeliveries');
const countRequests = document.getElementById('countRequests');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initRoleSelector();
  setupNavigation();
  initApp();

  // Auto refresh system status & metrics every 15s
  setInterval(() => {
    checkSystemStatus();
    loadMetrics();
  }, 15000);
});

async function initApp() {
  await determineApiUrl();
  await checkSystemStatus();
  await loadMetrics();
  await loadTabData(activeTab);
}

const VERCEL_BACKEND_URL = 'https://mongo-web-page.vercel.app';

// ----------------------------------------------------
// API BASE URL RESOLUTION
// ----------------------------------------------------
async function determineApiUrl() {
  // Clear any leftover localhost customApiUrl saved on mobile browsers
  if (customApiUrl && customApiUrl.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    customApiUrl = '';
    localStorage.removeItem('custom_api_url');
  }

  if (customApiUrl) {
    resolvedApiUrl = customApiUrl.replace(/\/$/, '');
    return resolvedApiUrl;
  }

  // 1. Try relative path '/api/status' (when served from same server)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);
    const res = await fetch('/api/status', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      resolvedApiUrl = '';
      return '';
    }
  } catch (e) {}

  // 2. Default to live Vercel Cloud Backend on GitHub Pages / Mobile
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const resVercel = await fetch(`${VERCEL_BACKEND_URL}/api/status`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resVercel.ok) {
      resolvedApiUrl = VERCEL_BACKEND_URL;
      return VERCEL_BACKEND_URL;
    }
  } catch (e) {}

  // 3. Fallback to Localhost:3000
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      const resLocal = await fetch('http://localhost:3000/api/status', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (resLocal.ok) {
        resolvedApiUrl = 'http://localhost:3000';
        return resolvedApiUrl;
      }
    } catch (e) {}
  }

  resolvedApiUrl = VERCEL_BACKEND_URL;
  return VERCEL_BACKEND_URL;
}

function getApiEndpoint(path) {
  if (!resolvedApiUrl) return path;
  return `${resolvedApiUrl}${path}`;
}

// ----------------------------------------------------
// SIDEBAR TOGGLE & AUTO-HIDE HANDLERS
// ----------------------------------------------------
function toggleSidebar(forceState) {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const mainContent = document.querySelector('.main-content');
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    const isOpen = sidebar.classList.contains('sidebar-mobile-open');
    const newState = forceState !== undefined ? forceState : !isOpen;
    if (newState) {
      sidebar.classList.add('sidebar-mobile-open');
      if (overlay) overlay.classList.remove('hidden');
    } else {
      sidebar.classList.remove('sidebar-mobile-open');
      if (overlay) overlay.classList.add('hidden');
    }
  } else {
    const isCollapsed = sidebar.classList.contains('collapsed');
    const newState = forceState !== undefined ? !forceState : !isCollapsed;
    if (newState) {
      sidebar.classList.add('collapsed');
      if (mainContent) mainContent.classList.add('full-width');
    } else {
      sidebar.classList.remove('collapsed');
      if (mainContent) mainContent.classList.remove('full-width');
    }
  }
}

// ----------------------------------------------------
// NAVIGATION & EVENT LISTENERS
// ----------------------------------------------------
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      
      activeTab = button.getAttribute('data-tab');
      updateTabHeader();
      loadTabData(activeTab);

      // Auto hide sidebar on mobile after selecting a tab
      if (window.innerWidth <= 768) {
        toggleSidebar(false);
      }
    });
  });

  document.getElementById('btnRefresh').addEventListener('click', async () => {
    await checkSystemStatus();
    await loadMetrics();
    await loadTabData(activeTab);
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
  // If opened directly via file:// protocol
  if (window.location.protocol === 'file:') {
    statusDot.className = 'status-indicator offline';
    statusText.textContent = 'Backend Not Started';
    if (statusSub) statusSub.textContent = 'File Protocol (file://)';
    connectionWarning.classList.remove('hidden');
    if (warningBannerText) {
      warningBannerText.innerHTML = `
        <strong>Server Not Running:</strong> You opened <code>index.html</code> directly as a local file. To connect with MongoDB Atlas live, run <code>npm start</code> in terminal and open <strong>http://localhost:3000</strong>.
      `;
    }
    return;
  }

  await determineApiUrl();

  try {
    const res = await fetch(getApiEndpoint('/api/status'));
    const data = await res.json();
    dbConnected = data.connected;

    if (data.connected) {
      statusDot.className = 'status-indicator online';
      statusText.textContent = 'MongoDB Atlas Connected';
      if (statusSub) {
        statusSub.textContent = resolvedApiUrl ? `Server: ${resolvedApiUrl}` : 'Database: R2D';
      }
      connectionWarning.classList.add('hidden');
    } else {
      statusDot.className = 'status-indicator offline';
      statusText.textContent = 'URI Password Required';
      if (statusSub) statusSub.textContent = 'Database: Disconnected';
      connectionWarning.classList.remove('hidden');
      if (warningBannerText) {
        warningBannerText.innerHTML = `
          <strong>MongoDB Atlas URI Setup Needed:</strong> 
          Your <code>.env</code> file needs your MongoDB connection string password. Update <code>MONGODB_URI</code> in <code>.env</code> with your cluster password to sync live data!
        `;
      }
    }
  } catch (err) {
    statusDot.className = 'status-indicator offline';
    statusText.textContent = 'Server Offline';
    if (statusSub) statusSub.textContent = 'Database: Unreachable';
    connectionWarning.classList.remove('hidden');

    const isGitHubPages = window.location.hostname.includes('github.io');
    if (warningBannerText) {
      if (isGitHubPages) {
        warningBannerText.innerHTML = `
          <strong>Backend Offline (GitHub Pages Static Host):</strong> 
          GitHub Pages hosts static files only. To connect to live MongoDB Atlas, run <code>npm start</code> on your computer (listening at <code>http://localhost:3000</code>) or set your deployed API URL.
        `;
      } else {
        warningBannerText.innerHTML = `
          <strong>Backend Server Offline:</strong> The Express API server is not responding. Run <code>npm start</code> in terminal to start the server.
        `;
      }
    }
  }
}

async function loadMetrics() {
  try {
    const [inv, ord, del, req] = await Promise.all([
      fetch(getApiEndpoint('/api/inventory')).then(r => r.json()),
      fetch(getApiEndpoint('/api/purchase-orders')).then(r => r.json()),
      fetch(getApiEndpoint('/api/deliveries')).then(r => r.json()),
      fetch(getApiEndpoint('/api/purchase-requests')).then(r => r.json())
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
  tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: var(--text-muted);">
    <i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Fetching from MongoDB Atlas...</td></tr>`;
  emptyState.classList.add('hidden');

  // Fallback sample data if opened directly via file:// protocol
  if (window.location.protocol === 'file:') {
    loadSampleDataFallback(tab);
    return;
  }

  const endpointMap = {
    inventory: '/api/inventory',
    orders: '/api/purchase-orders',
    deliveries: '/api/deliveries',
    requests: '/api/purchase-requests'
  };

  try {
    const res = await fetch(getApiEndpoint(endpointMap[tab]));
    const json = await res.json();

    if (json.success) {
      activeData = json.data;
      renderTable(activeData);
    } else {
      showToast(json.error || 'Failed to fetch data', 'error');
    }
  } catch (err) {
    const isGitHubPages = window.location.hostname.includes('github.io');
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px;">
      <div style="max-width: 520px; margin: 0 auto; background: var(--bg-card); padding: 25px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <i class="fa-solid fa-plug-circle-xmark fa-3x" style="color: var(--accent-orange); margin-bottom: 15px;"></i>
        <h4 style="color: var(--text-primary); font-size: 17px; margin-bottom: 8px;">Backend API Server Offline</h4>
        <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 20px; line-height: 1.6;">
          ${isGitHubPages 
            ? 'GitHub Pages is hosting static frontend files. To view and write live data to MongoDB Atlas, start <code>node server.js</code> locally on your PC or enter your deployed server URL.' 
            : 'Unable to connect to Express backend server. Please verify that <code>npm start</code> is running.'}
        </p>
        <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="connectLocalhostAndRetry()"><i class="fa-solid fa-plug"></i> Connect Localhost:3000</button>
          <button class="btn btn-outline btn-sm" onclick="toggleServerModal(true)"><i class="fa-solid fa-sliders"></i> Set Backend URL</button>
          <button class="btn btn-ghost btn-sm" onclick="loadSampleDataFallback('${tab}')"><i class="fa-solid fa-eye"></i> View Sample Demo</button>
        </div>
      </div>
    </td></tr>`;
  }
}

function loadSampleDataFallback(tab) {
  const sampleData = {
    inventory: [
      { _id: '1', itemName: 'Sample Laptop', category: 'Electronics', quantity: 15, unitPrice: 899.99, location: 'Warehouse A', status: 'In Stock' },
      { _id: '2', itemName: 'Office Chair', category: 'Furniture', quantity: 5, unitPrice: 149.50, location: 'Warehouse B', status: 'In Stock' }
    ],
    orders: [
      { _id: '1', orderNumber: 'PO-2026-001', supplier: 'TechCorp Supplies', totalAmount: 4500.00, itemsCount: 12, status: 'Completed' }
    ],
    deliveries: [
      { _id: '1', trackingNumber: 'TRK-987654', carrier: 'FedEx Express', destination: 'Main Hub', estimatedArrival: 'Tomorrow', status: 'In Transit' }
    ],
    requests: [
      { _id: '1', title: 'New Test Request', requestedBy: 'Akash', department: 'IT', priority: 'High', estimatedCost: 500.00, status: 'Under Review' }
    ]
  };
  
  activeData = sampleData[tab] || [];
  renderTable(activeData);
  showToast('Loaded sample demo data (Server offline)', 'error');
}

// ----------------------------------------------------
// TAT & DOER HELPERS
// ----------------------------------------------------
function getTATBadgeHtml(createdAt) {
  if (!createdAt) return `<span class="badge badge-info" title="TAT Clock"><i class="fa-solid fa-stopwatch"></i> TAT: 10m</span>`;
  const start = new Date(createdAt).getTime();
  const now = new Date().getTime();
  const diffMs = Math.max(0, now - start);

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let label = '';
  if (diffDays > 0) {
    label = `${diffDays}d ${diffHours % 24}h`;
  } else if (diffHours > 0) {
    label = `${diffHours}h ${diffMins % 60}m`;
  } else {
    label = `${diffMins}m`;
  }

  let badgeClass = 'badge-success';
  if (diffHours >= 48) {
    badgeClass = 'badge-danger';
    label += ' (Overdue)';
  } else if (diffHours >= 24) {
    badgeClass = 'badge-warning';
  }

  return `<span class="badge ${badgeClass}" title="Turnaround Time (Creation to now)"><i class="fa-solid fa-stopwatch"></i> TAT: ${label}</span>`;
}

function getDoerBadgeHtml(item) {
  const doer = item.lastDoer || 'Requester';
  const role = item.doerRole ? ` (${item.doerRole})` : '';
  return `<span class="doer-pill" title="Last Doer: ${escapeHtml(doer)}${role}"><i class="fa-solid fa-user-gear"></i> ${escapeHtml(doer)}</span>`;
}

// Role Management & Authorization
function initRoleSelector() {
  const select = document.getElementById('userRoleSelect');
  if (select) select.value = currentUserRole;
}

function changeUserRole(role) {
  currentUserRole = role;
  localStorage.setItem('user_role', role);
  showToast(`Switched Active Role to ${role}`, 'success');
  renderTable(activeData);
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
        <th>Unit Price (₹)</th>
        <th>Doer</th>
        <th>TAT</th>
        <th>Approval Workflow</th>
      </tr>
    `;

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.itemName)}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(item.category)}</span></td>
        <td>${item.quantity} units</td>
        <td><strong>₹${Number(item.unitPrice).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
        <td>${getDoerBadgeHtml(item)}</td>
        <td>${getTATBadgeHtml(item.createdAt)}</td>
        <td>${getApprovalActionButtons(item)}</td>
      `;
      tableBody.appendChild(tr);
    });

  } else if (activeTab === 'orders') {
    tableHeader.innerHTML = `
      <tr>
        <th>Order #</th>
        <th>Supplier</th>
        <th>Total Amount (₹)</th>
        <th>Items</th>
        <th>Doer</th>
        <th>TAT</th>
        <th>Approval Workflow</th>
      </tr>
    `;

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.orderNumber)}</strong></td>
        <td>${escapeHtml(item.supplier)}</td>
        <td><strong>₹${Number(item.totalAmount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
        <td>${item.itemsCount}</td>
        <td>${getDoerBadgeHtml(item)}</td>
        <td>${getTATBadgeHtml(item.createdAt)}</td>
        <td>${getApprovalActionButtons(item)}</td>
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
        <th>Doer</th>
        <th>TAT</th>
        <th>Approval Workflow</th>
      </tr>
    `;

    data.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(item.trackingNumber)}</strong></td>
        <td>${escapeHtml(item.carrier)}</td>
        <td>${escapeHtml(item.destination)}</td>
        <td>${escapeHtml(item.estimatedArrival)}</td>
        <td>${getDoerBadgeHtml(item)}</td>
        <td>${getTATBadgeHtml(item.createdAt)}</td>
        <td>${getApprovalActionButtons(item)}</td>
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
        <th>Est. Cost (₹)</th>
        <th>Doer</th>
        <th>TAT</th>
        <th>Workflow Action</th>
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
        <td><strong>₹${Number(item.estimatedCost).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
        <td>${getDoerBadgeHtml(item)}</td>
        <td>${getTATBadgeHtml(item.createdAt)}</td>
        <td>${getApprovalActionButtons(item)}</td>
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
        <label>Unit Price (₹)</label>
        <input type="number" step="0.01" name="unitPrice" class="form-control" value="2500.00">
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
        <label>Total Amount (₹) *</label>
        <input type="number" step="0.01" name="totalAmount" class="form-control" value="15000.00" required>
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
        <label>Estimated Cost (₹)</label>
        <input type="number" step="0.01" name="estimatedCost" class="form-control" value="30000.00">
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
    const res = await fetch(getApiEndpoint(endpointMap[activeTab]), {
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
// DELETE RECORD FROM MONGODB (1-Click, No Browser Confirm Alert)
// ----------------------------------------------------
async function deleteRecord(id) {
  const endpointMap = {
    inventory: '/api/inventory',
    orders: '/api/purchase-orders',
    deliveries: '/api/deliveries',
    requests: '/api/purchase-requests'
  };

  try {
    const res = await fetch(getApiEndpoint(`${endpointMap[activeTab]}/${id}`), {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      showToast('Record deleted successfully from MongoDB!', 'success');
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
// MULTI-STAGE APPROVAL WORKFLOW HANDLERS (No Pop-ups!)
// ----------------------------------------------------
function getApprovalBadgeHtml(status) {
  const s = status || 'Pending HoD Approval';
  if (s === 'Approved by HoD' || s === 'HoD Approved (Pending Store)') {
    return `<span class="badge badge-info" title="Approved by Department Head"><i class="fa-solid fa-user-check"></i> HoD Approved</span>`;
  } else if (s === 'Dispatched') {
    return `<span class="badge badge-success" title="Store Stock Available & Dispatched"><i class="fa-solid fa-truck-ramp-box"></i> Dispatched</span>`;
  } else if (s.includes('Partially Dispatched')) {
    return `<span class="badge badge-warning" title="Partial Stock Issued + PO Created"><i class="fa-solid fa-boxes-packing"></i> Partial Dispatched</span>`;
  } else if (s === 'Sent to Purchase Team') {
    return `<span class="badge badge-warning" title="Out of Stock - Sent to Procurement"><i class="fa-solid fa-cart-shopping"></i> Purchase Team</span>`;
  } else if (s.includes('Rejected')) {
    return `<span class="badge badge-danger" title="Request Rejected"><i class="fa-solid fa-ban"></i> Rejected</span>`;
  } else {
    return `<span class="badge badge-warning" title="Awaiting Department Head Approval"><i class="fa-solid fa-user-clock"></i> Pending HoD</span>`;
  }
}

function getApprovalActionButtons(item) {
  const id = item._id;
  const status = item.approvalStatus || 'Pending HoD Approval';

  let buttons = '';

  // Stage 1: Pending HoD Approval (Authorized: HoD / Admin)
  if (status === 'Pending HoD Approval' || status === 'Pending Store Check') {
    buttons += `<button class="btn-wf btn-wf-hod" onclick="updateApproval('${id}', 'HoD Approved (Pending Store)', 'HoD')" title="Approve as Head of Department"><i class="fa-solid fa-user-check"></i> HoD Approve</button>`;
    buttons += `<button class="btn-wf btn-wf-reject" onclick="updateApproval('${id}', 'Rejected by HoD', 'HoD')" title="Reject Request"><i class="fa-solid fa-xmark"></i> Reject</button>`;
  } 
  // Stage 2: HoD Approved -> Store Check (Full In Stock, Partial Available, or Out of Stock)
  else if (status === 'HoD Approved (Pending Store)' || status === 'Approved by Head' || status === 'Store Checked') {
    buttons += `<button class="btn-wf btn-wf-dispatch" onclick="updateApproval('${id}', 'Dispatched', 'Store Manager')" title="100% In Stock -> Dispatch Item"><i class="fa-solid fa-boxes-packing"></i> Full In Stock (Dispatch)</button>`;
    buttons += `<button class="btn-wf btn-wf-purchase" onclick="updateApproval('${id}', 'Partially Dispatched (Stock + PO)', 'Store Manager')" title="Partial Stock -> Issue Stock & Create PO for rest"><i class="fa-solid fa-layer-group"></i> Partial Available</button>`;
    buttons += `<button class="btn-wf btn-wf-reject" onclick="updateApproval('${id}', 'Sent to Purchase Team', 'Store Manager')" title="Out of Stock -> Forward to Purchase Team"><i class="fa-solid fa-cart-shopping"></i> Out of Stock (PO)</button>`;
  }
  // Completed / Forwarded stages
  else if (status === 'Dispatched') {
    buttons += `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Dispatched</span>`;
  } else if (status.includes('Partially Dispatched')) {
    buttons += `<span class="badge badge-warning"><i class="fa-solid fa-circle-half-stroke"></i> Partial + PO Created</span>`;
  } else if (status === 'Sent to Purchase Team') {
    buttons += `<span class="badge badge-warning"><i class="fa-solid fa-spinner fa-spin"></i> Sent to Purchase</span>`;
  } else if (status.includes('Rejected')) {
    buttons += `<span class="badge badge-danger"><i class="fa-solid fa-ban"></i> Rejected</span>`;
  }

  // Delete button (1-click)
  buttons += `<button class="action-btn delete-btn" onclick="deleteRecord('${id}')" title="Delete Record"><i class="fa-solid fa-trash"></i></button>`;

  return `<div class="workflow-actions">${buttons}</div>`;
}

async function updateApproval(id, newStatus, requiredRole) {
  // Authorization Check: Particular person/role only
  if (currentUserRole !== 'Admin' && currentUserRole !== requiredRole) {
    showToast(`Access Denied! Only "${requiredRole}" or "Admin" role can perform this stage!`, 'error');
    return;
  }

  const doerTitle = `${currentUserRole}`;

  try {
    const res = await fetch(getApiEndpoint(`/api/approval/${activeTab}/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approvalStatus: newStatus,
        lastDoer: doerTitle,
        doerRole: requiredRole
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Action "${newStatus}" performed by ${doerTitle}!`, 'success');
      loadMetrics();
      loadTabData(activeTab);
    } else {
      showToast(result.error || 'Failed to update approval status', 'error');
    }
  } catch (err) {
    showToast('Network error updating approval status', 'error');
  }
}

// ----------------------------------------------------
// SERVER MODAL & CONFIGURATION HANDLERS
// ----------------------------------------------------
function toggleServerModal(show) {
  if (show) {
    inputServerUrl.value = customApiUrl || resolvedApiUrl || 'http://localhost:3000';
    serverModal.classList.remove('hidden');
  } else {
    serverModal.classList.add('hidden');
  }
}

async function saveServerUrl() {
  const newUrl = inputServerUrl.value.trim().replace(/\/$/, '');
  customApiUrl = newUrl;
  localStorage.setItem('custom_api_url', newUrl);
  resolvedApiUrl = newUrl;
  toggleServerModal(false);
  showToast('Server URL updated! Testing connection...', 'success');
  await checkSystemStatus();
  await loadMetrics();
  await loadTabData(activeTab);
}

async function useLocalhostServer() {
  inputServerUrl.value = 'http://localhost:3000';
  await saveServerUrl();
}

async function clearServerUrl() {
  customApiUrl = '';
  localStorage.removeItem('custom_api_url');
  inputServerUrl.value = '';
  await determineApiUrl();
  toggleServerModal(false);
  showToast('Reset server URL to auto-detect', 'success');
  await checkSystemStatus();
  await loadMetrics();
  await loadTabData(activeTab);
}

async function connectLocalhostAndRetry() {
  customApiUrl = 'http://localhost:3000';
  localStorage.setItem('custom_api_url', customApiUrl);
  resolvedApiUrl = customApiUrl;
  showToast('Connecting to http://localhost:3000...', 'success');
  await checkSystemStatus();
  await loadMetrics();
  await loadTabData(activeTab);
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

// ----------------------------------------------------
// DAY / NIGHT THEME TOGGLE HANDLERS
// ----------------------------------------------------
function initTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeUI();
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', currentTheme);
  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeUI();
  showToast(`Switched to ${currentTheme === 'light' ? 'Day' : 'Night'} Mode`, 'success');
}

function updateThemeUI() {
  const themeIcon = document.getElementById('themeIcon');
  const themeLabel = document.getElementById('themeLabel');
  if (!themeIcon || !themeLabel) return;

  if (currentTheme === 'light') {
    themeIcon.className = 'fa-solid fa-sun';
    themeIcon.style.color = '#f59e0b';
    themeLabel.textContent = 'Day Mode';
  } else {
    themeIcon.className = 'fa-solid fa-moon';
    themeIcon.style.color = '#3b82f6';
    themeLabel.textContent = 'Night Mode';
  }
}
