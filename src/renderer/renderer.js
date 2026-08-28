
// ==================== APP STARTUP INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Fetch initial stock & expiry alerts on launch
    await refreshAlertBadges();

    // 2. Pre-populate initial view dropdowns if starting on Add Medicine / Add Batch
    if (typeof displayDrugDropdown === 'function') {
      await displayDrugDropdown();
    }
  } catch (err) {
    console.error('Failed to initialize app on startup:', err);
  }
});


// ====================  SIDEBAR TAB NAVIGATION ====================
const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');
const pageTitle = document.getElementById('page-title');

navItems.forEach((item) => {
  item.addEventListener('click', async () => {

    navItems.forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');


    const targetViewId = item.getAttribute('data-view');
    viewPanels.forEach((panel) => panel.classList.remove('active'));

    const activePanel = document.getElementById(targetViewId);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    await refreshAlertBadges();

    if (pageTitle) {
      pageTitle.innerText = item.innerText.replace(/[^\w\s()]/gi, '').trim();
    }

    if (targetViewId === 'add-batch-view') {
      await displayDrugDropdown();
    } else if (targetViewId === 'inventory-view') {
      await loadInventory();
    } else if (targetViewId === 'pos-view') {
      await loadPosStock();
    } else if (targetViewId === 'sales-view') {
      await loadSalesHistory();
    } else if (targetViewId === 'reports-view') {
      await loadAnalyticsDashboard();
    }
  });
});

// ====================  ADD MEDICINE FORM HANDLER ====================
const drugForm = document.getElementById('drug-form');
const drugStatusMsg = document.getElementById('drug-status-msg');

if (drugForm) {
  drugForm.addEventListener('submit', async (e) => {
    e.preventDefault();


    const drugData = {
      brand_name: document.getElementById('brand_name').value.trim(),
      generic_name: document.getElementById('generic_name').value.trim(),
      category: document.getElementById('category').value.trim(),
      min_stock_alert: parseInt(document.getElementById('min_stock_alert').value, 10) || 10
    };


    drugStatusMsg.style.color = '#475569';
    drugStatusMsg.innerText = 'Saving medicine...';


    const response = await window.api.addDrug(drugData);


    if (response.success) {
      drugStatusMsg.style.color = '#16a34a';
      drugStatusMsg.innerText = '✓ Medicine saved successfully!';
      drugForm.reset();
      document.getElementById('min_stock_alert').value = '10';
    } else {
      drugStatusMsg.style.color = '#dc2626';
      drugStatusMsg.innerText = '✗ Error: ' + response.error;
    }
  });
}



// ====================  ADD BATCH FORM HANDLER ====================

async function displayDrugDropdown() {
  const select = document.getElementById('batch_drug_select');
  if (!select) return;

  const allDrugs = await window.api.getAllDrugs();

  if (allDrugs.success) {
    select.innerHTML = '<option value="">-- Choose Medicine --</option>';
    allDrugs.data.forEach((drug) => {
      const option = document.createElement('option');
      option.value = drug.id;
      option.textContent = `${drug.brand_name} (${drug.generic_name || 'N/A'})`;
      select.appendChild(option);
    });
  }
}

if (document.getElementById('batch_drug_select')) {
  displayDrugDropdown();
}


const batchForm = document.getElementById('batch-form');
const batchStatusMsg = document.getElementById('batch-status-msg');

if (batchForm) {
  batchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const batchData = {
      drug_id: parseInt(document.getElementById('batch_drug_select').value, 10),
      batch_number: document.getElementById('batch_number').value.trim(),
      expiry_date: document.getElementById('expiry_date').value,
      buy_price: parseFloat(document.getElementById('buy_price').value),
      sell_price: parseFloat(document.getElementById('sell_price').value),
      quantity: parseInt(document.getElementById('quantity').value, 10)
    };

    batchStatusMsg.style.color = '#475569';
    batchStatusMsg.innerText = 'Saving batch...';

    const response = await window.api.addBatch(batchData);

    if (response.success) {
      batchStatusMsg.style.color = '#16a34a';
      batchStatusMsg.innerText = '✓ Batch saved successfully!';
      batchForm.reset();
    } else {
      batchStatusMsg.style.color = '#dc2626';
      batchStatusMsg.innerText = '✗ Error: ' + response.error;
    }
  });
}

// ====================  Load and render inventory data ====================

async function loadInventory() {
  const tableBody = document.getElementById('inventory-table-body');
  if (!tableBody) return;

  const response = await window.api.getInventory();

  if (!response.success || response.data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: #64748b; padding: 20px;">
          No inventory records found. Add medicines and batches to view stock.
        </td>
      </tr>`;
    return;
  }

  tableBody.innerHTML = '';

  response.data.forEach((row) => {
    const tr = document.createElement('tr');

    // Stock Badge Status
    let statusBadge = '<span class="badge badge-in-stock">In Stock</span>';
    if (row.total_stock === 0) {
      statusBadge = '<span class="badge badge-out-of-stock">Out of Stock</span>';
    } else if (row.total_stock <= row.min_stock_alert) {
      statusBadge = '<span class="badge badge-low-stock">Low Stock</span>';
    }

    tr.innerHTML = `
      <td><strong>${row.brand_name}</strong></td>
      <td>${row.generic_name || '-'}</td>
      <td>${row.category || '-'}</td>
      <td>${row.batch_number ? `<code>${row.batch_number}</code>` : '<span style="color: #94a3b8;">No Batches</span>'}</td>
      <td>${row.expiry_date || '-'}</td>
      <td>${row.sell_price ? row.sell_price.toFixed(2) : '-'}</td>
      <td>${row.batch_quantity !== null ? row.batch_quantity : 0}</td>
      <td><strong>${row.total_stock}</strong></td>
      <td>${statusBadge}</td>
    `;

    tableBody.appendChild(tr);
  });
}

// Attach to sidebar navigation
navItems.forEach((item) => {
  item.addEventListener('click', async () => {
    const targetViewId = item.getAttribute('data-view');
    if (targetViewId === 'inventory-view') {
      await loadInventory();
    }
  });
});

// Manual Refresh Button Handler
const refreshInventoryBtn = document.getElementById('refresh-inventory-btn');
if (refreshInventoryBtn) {
  refreshInventoryBtn.addEventListener('click', loadInventory);
}


// ==================== POS / BILLING MODULE ====================
let availablePosStock = [];
let currentCart = [];

// Display POS dropdown with in-stock items
async function loadPosStock() {
  const select = document.getElementById('pos_batch_select');
  if (!select) return;

  const res = await window.api.getPosStock();
  if (res.success) {
    availablePosStock = res.data;
    select.innerHTML = '<option value="">-- Select Available Item --</option>';
    availablePosStock.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.batch_id;
      option.textContent = `${item.brand_name} | Batch: ${item.batch_number} | Exp: ${item.expiry_date} | Stock: ${item.available_qty} | LKR ${item.sell_price.toFixed(2)}`;
      select.appendChild(option);
    });
  }
}

// Render Cart Table
function renderCart() {
  const cartBody = document.getElementById('cart-table-body');
  const totalDisplay = document.getElementById('grand-total-display');
  if (!cartBody || !totalDisplay) return;

  if (currentCart.length === 0) {
    cartBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 14px;">Cart is empty.</td></tr>`;
    totalDisplay.innerText = 'LKR 0.00';
    return;
  }

  cartBody.innerHTML = '';
  let grandTotal = 0;

  currentCart.forEach((item, index) => {
    grandTotal += item.total_price;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.brand_name} <br><small style="color: #64748b;">${item.batch_number}</small></td>
      <td>${item.sell_price.toFixed(2)}</td>
      <td>${item.quantity}</td>
      <td><strong>${item.total_price.toFixed(2)}</strong></td>
      <td><button onclick="removeFromCart(${index})" style="background: #fee2e2; color: #b91c1c; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✕</button></td>
    `;
    cartBody.appendChild(tr);
  });

  totalDisplay.innerText = `LKR ${grandTotal.toFixed(2)}`;
}


// Global removal helper
window.removeFromCart = (index) => {
  currentCart.splice(index, 1);
  renderCart();
};


// Add to Cart button listener
const addToCartBtn = document.getElementById('add-to-cart-btn');
if (addToCartBtn) {
  addToCartBtn.addEventListener('click', () => {
    const batchId = parseInt(document.getElementById('pos_batch_select').value, 10);
    const qty = parseInt(document.getElementById('pos_qty').value, 10);
    const msg = document.getElementById('pos-input-msg');

    if (!batchId || !qty || qty <= 0) {
      msg.style.color = '#dc2626';
      msg.innerText = 'Please select a valid medicine and quantity.';
      return;
    }

    const selectedStock = availablePosStock.find((s) => s.batch_id === batchId);
    if (!selectedStock) return;

    if (qty > selectedStock.available_qty) {
      msg.style.color = '#dc2626';
      msg.innerText = `Only ${selectedStock.available_qty} units available in this batch.`;
      return;
    }

    // Check if already in cart
    const existingIndex = currentCart.findIndex((i) => i.batch_id === batchId);
    if (existingIndex > -1) {
      if (currentCart[existingIndex].quantity + qty > selectedStock.available_qty) {
        msg.style.color = '#dc2626';
        msg.innerText = `Cannot exceed total stock (${selectedStock.available_qty}).`;
        return;
      }
      currentCart[existingIndex].quantity += qty;
      currentCart[existingIndex].total_price = currentCart[existingIndex].quantity * selectedStock.sell_price;
    } else {
      currentCart.push({
        batch_id: selectedStock.batch_id,
        brand_name: selectedStock.brand_name,
        batch_number: selectedStock.batch_number,
        sell_price: selectedStock.sell_price,
        quantity: qty,
        total_price: qty * selectedStock.sell_price
      });
    }

    msg.innerText = '';
    renderCart();
  });
}


// Checkout button listener
const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', async () => {
    const msg = document.getElementById('checkout-status-msg');
    if (currentCart.length === 0) {
      msg.style.color = '#dc2626';
      msg.innerText = 'Cart is empty. Add items first.';
      return;
    }

    const grandTotal = currentCart.reduce((sum, item) => sum + item.total_price, 0);

    msg.style.color = '#475569';
    msg.innerText = 'Processing sale...';

    const res = await window.api.checkout({ cart: currentCart, total: grandTotal });

    if (res.success) {
      msg.style.color = '#16a34a';
      msg.innerText = `✓ Sale completed! Invoice #${res.data.saleId}`;
      currentCart = [];
      renderCart();
      await loadPosStock(); // Refresh dropdown with updated remaining stock
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;
    }
  });
}

// Hook into tab navigation to reload POS stock when clicking the tab
navItems.forEach((item) => {
  item.addEventListener('click', async () => {
    const targetViewId = item.getAttribute('data-view');
    if (targetViewId === 'pos-view') {
      await loadPosStock();
    }
  });
});


// ==================== SALES HISTORY MODULE ====================

// Fetch & display all sales in table
async function loadSalesHistory() {
  const tableBody = document.getElementById('sales-table-body');
  const revenueBanner = document.getElementById('total-revenue-banner');
  if (!tableBody) return;

  const res = await window.api.getAllSales();

  if (!res.success || res.data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">No sales recorded yet.</td></tr>`;
    if (revenueBanner) revenueBanner.innerText = 'Total Revenue: LKR 0.00';
    return;
  }

  tableBody.innerHTML = '';
  let cumulativeRevenue = 0;

  res.data.forEach((sale) => {
    cumulativeRevenue += sale.total_amount;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${sale.sale_id}</strong></td>
      <td>${sale.sale_date}</td>
      <td>${sale.item_count} items</td>
      <td><strong>LKR ${sale.total_amount.toFixed(2)}</strong></td>
      <td>
        <button onclick="viewReceipt(${sale.sale_id})" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-weight: 600;">View Details</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  if (revenueBanner) {
    revenueBanner.innerText = `Total Revenue: LKR ${cumulativeRevenue.toFixed(2)}`;
  }
}

// Open Receipt Inspection Modal
window.viewReceipt = async (saleId) => {
  const modal = document.getElementById('receipt-modal');
  const title = document.getElementById('modal-invoice-title');
  const itemsBody = document.getElementById('receipt-items-body');

  title.innerText = `Invoice Receipt #${saleId}`;
  itemsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 10px;">Loading...</td></tr>`;
  modal.style.display = 'flex';

  const res = await window.api.getSaleDetails(saleId);
  if (res.success) {
    itemsBody.innerHTML = '';
    res.data.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.brand_name}</strong></td>
        <td><code>${item.batch_number}</code></td>
        <td>${item.quantity}</td>
        <td>${item.unit_price.toFixed(2)}</td>
        <td><strong>${item.total_price.toFixed(2)}</strong></td>
      `;
      itemsBody.appendChild(tr);
    });
  }
};

// Close modal button handler
const closeModalBtn = document.getElementById('close-modal-btn');
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    document.getElementById('receipt-modal').style.display = 'none';
  });
}

// Refresh button handler
const refreshSalesBtn = document.getElementById('refresh-sales-btn');
if (refreshSalesBtn) {
  refreshSalesBtn.addEventListener('click', loadSalesHistory);
}


// ==================== REPORTS & CHARTS MODULE ====================
let salesChartInstance = null;
let analyticsCache = null;

async function loadAnalyticsDashboard() {
  const res = await window.api.getAnalytics();
  if (!res.success) return;

  analyticsCache = res.data;

  // Update KPI Cards
  document.getElementById('kpi-today-rev').innerText = `LKR ${analyticsCache.kpis.today.today_revenue.toFixed(2)}`;
  document.getElementById('kpi-today-orders').innerText = `${analyticsCache.kpis.today.today_orders} transactions`;

  document.getElementById('kpi-month-rev').innerText = `LKR ${analyticsCache.kpis.month.month_revenue.toFixed(2)}`;
  document.getElementById('kpi-month-orders').innerText = `${analyticsCache.kpis.month.month_orders} transactions`;

  document.getElementById('kpi-total-rev').innerText = `LKR ${analyticsCache.kpis.total.all_time_revenue.toFixed(2)}`;
  document.getElementById('kpi-total-orders').innerText = `${analyticsCache.kpis.total.all_time_orders} transactions`;

  // Default render: Daily
  renderSalesChart('daily');
}


function renderSalesChart(periodType) {
  const canvas = document.getElementById('salesChart');
  if (!canvas || !analyticsCache) return;

  let dataset = [];
  let labelText = 'Daily Sales (LKR)';

  if (periodType === 'daily') {
    dataset = analyticsCache.daily;
    labelText = 'Daily Sales (LKR)';
  } else if (periodType === 'weekly') {
    dataset = analyticsCache.weekly;
    labelText = 'Weekly Sales (LKR)';
  } else if (periodType === 'monthly') {
    dataset = analyticsCache.monthly;
    labelText = 'Monthly Sales (LKR)';
  }

  const labels = dataset.map((d) => d.period);
  const data = dataset.map((d) => d.total_revenue);

  // Destroy previous chart instance before drawing a new one
  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  salesChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length > 0 ? labels : ['No Sales Recorded'],
      datasets: [
        {
          label: labelText,
          data: data.length > 0 ? data : [0],
          backgroundColor: 'rgba(2, 132, 199, 0.75)',
          borderColor: '#0284c7',
          borderWidth: 2,
          borderRadius: 6,
          maxBarThickness: 45
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => `LKR ${val}`
          },
          grid: { color: '#f1f5f9' }
        },
        x: {
          grid: { display: false }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` Revenue: LKR ${Number(item.raw).toFixed(2)}`
          }
        }
      }
    }
  });
}

// Chart filter buttons toggle
const filterButtons = document.querySelectorAll('.filter-btn');
filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active-filter'));
    btn.classList.add('active-filter');
    const period = btn.getAttribute('data-period');
    renderSalesChart(period);
  });
});


// Function to update the sidebar badge
async function refreshAlertBadges() {
  const badge = document.getElementById('sidebar-alert-badge');
  if (!badge) return;

  const res = await window.api.getAlertsSummary();
  if (res && res.success) {
    const totalAlerts = res.data.lowStockCount + res.data.expiringCount;
    if (totalAlerts > 0) {
      badge.style.display = 'inline-block';
      badge.innerText = `${totalAlerts}`;
    } else {
      badge.style.display = 'none';
    }
  }
}

refreshAlertBadges();