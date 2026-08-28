// ==================== APP INITIALIZATION & STATE ====================
let availablePosStock = [];
let currentCart = [];
let salesChartInstance = null;
let analyticsCache = null;

const viewTitles = {
  'add-drug-view': 'Register Medicine',
  'add-batch-view': 'Add Batch',
  'inventory-view': 'Inventory Overview',
  'pos-view': 'Billing (POS)',
  'sales-view': 'Sales History',
  'reports-view': 'Reports & Charts',
  'clear-inventory-view': 'System Reset & Wipe'
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await refreshAlertBadges();
    if (typeof displayDrugDropdown === 'function') {
      await displayDrugDropdown();
    }
    // Auto-focus brand name if initial active view is add-drug-view
    const bInput = document.getElementById('brand_name');
    if (bInput) {
      bInput.focus();
    }
  } catch (err) {
    console.error('Failed to initialize app on startup:', err);
  }
});

// ==================== SIDEBAR TAB NAVIGATION ====================
const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');
const pageTitle = document.getElementById('page-title');

navItems.forEach((item) => {
  item.addEventListener('click', async () => {
    const targetViewId = item.getAttribute('data-view');


    navItems.forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');

    viewPanels.forEach((panel) => panel.classList.remove('active'));
    const activePanel = document.getElementById(targetViewId);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    if (pageTitle && viewTitles[targetViewId]) {
      pageTitle.innerText = viewTitles[targetViewId];
    }

    await refreshAlertBadges();

    if (targetViewId === 'add-drug-view') {
      const bInput = document.getElementById('brand_name');
      if (bInput) {
        setTimeout(() => bInput.focus(), 50);
      }
    } else if (targetViewId === 'add-batch-view') {
      await displayDrugDropdown();
    } else if (targetViewId === 'inventory-view') {
      await loadInventory();
    } else if (targetViewId === 'pos-view') {
      await loadPosStock();
    } else if (targetViewId === 'sales-view') {
      await loadSalesHistory();
    } else if (targetViewId === 'reports-view') {
      await loadAnalyticsDashboard();
    } else if (targetViewId === 'clear-inventory-view') {
      await loadDeleteDrugDropdown();
    }
  });
});

// ==================== ADD MEDICINE MODULE ====================
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
      await refreshAlertBadges();

      if (brandInput) {
        brandInput.focus();
      }

      setTimeout(() => {
        drugStatusMsg.innerText = '';
      }, 2000);

    } else {
      drugStatusMsg.style.color = '#dc2626';
      drugStatusMsg.innerText = '✗ Error: ' + response.error;

      setTimeout(() => {
        drugStatusMsg.innerText = '';
      }, 2000);
    }
  });
}



// ==================== ADD MEDICINE KEYBOARD SHORTCUTS & JUMPS ====================
const brandInput = document.getElementById('brand_name');
const genericInput = document.getElementById('generic_name');
const categoryInput = document.getElementById('category');
const minStockInput = document.getElementById('min_stock_alert');

// 1. Enter on Brand Name -> Jumps to Generic Name
if (brandInput) {
  brandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (genericInput) {
        genericInput.focus();
        genericInput.select();
      }
    }
  });
}

// 2. Enter on Generic Name -> Jumps to Category
if (genericInput) {
  genericInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (categoryInput) {
        categoryInput.focus();
        categoryInput.select();
      }
    }
  });
}

// 3. Enter on Category -> Jumps to Min Stock Alert
if (categoryInput) {
  categoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (minStockInput) {
        minStockInput.focus();
        minStockInput.select();
      }
    }
  });
}

// 4. Enter on Min Stock Alert -> Submits and saves the medicine
if (minStockInput) {
  minStockInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = document.getElementById('drug-form');
      if (form) {
        form.requestSubmit(); // Triggers the drug-form submit listener
      }
    }
  });
}




// ==================== ADD BATCH MODULE ====================
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
      await refreshAlertBadges();

      setTimeout(() => {
        batchStatusMsg.innerText = '';
      }, 2000);
    } else {
      batchStatusMsg.style.color = '#dc2626';
      batchStatusMsg.innerText = '✗ Error: ' + response.error;

      setTimeout(() => {
        batchStatusMsg.innerText = '';
      }, 2000);
    }
  });
}

// ==================== INVENTORY OVERVIEW MODULE ====================
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
      <td>${row.sell_price ? Number(row.sell_price).toFixed(2) : '-'}</td>
      <td>${row.batch_quantity !== null ? row.batch_quantity : 0}</td>
      <td><strong>${row.total_stock}</strong></td>
      <td>${statusBadge}</td>
    `;

    tableBody.appendChild(tr);
  });
}

const refreshInventoryBtn = document.getElementById('refresh-inventory-btn');
if (refreshInventoryBtn) {
  refreshInventoryBtn.addEventListener('click', loadInventory);
}

// ==================== POS / BILLING MODULE ====================
async function loadPosStock() {
  const datalist = document.getElementById('pos_stock_datalist');
  const drugInput = document.getElementById('pos_drug_input');
  if (!datalist) return;

  const res = await window.api.getPosStock();
  if (res.success) {
    availablePosStock = res.data;
    datalist.innerHTML = '';

    availablePosStock.forEach((item) => {
      const option = document.createElement('option');
      option.value = `${item.brand_name} | Batch: ${item.batch_number} | Exp: ${item.expiry_date} | Stock: ${item.available_qty} | LKR ${item.sell_price.toFixed(2)}`;
      datalist.appendChild(option);
    });
  }

  if (drugInput) {
    setTimeout(() => drugInput.focus(), 50);
  }
}

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

window.removeFromCart = (index) => {
  currentCart.splice(index, 1);
  renderCart();
};

function handleAddToCart() {
  const drugInput = document.getElementById('pos_drug_input');
  const qtyInput = document.getElementById('pos_qty');
  const msg = document.getElementById('pos-input-msg');

  const selectedText = drugInput.value.trim();
  const qty = parseInt(qtyInput.value, 10);

  const selectedStock = availablePosStock.find(
    (item) =>
      selectedText.includes(item.batch_number) &&
      selectedText.includes(item.brand_name)
  );

  if (!selectedStock) {
    msg.style.color = '#dc2626';
    msg.innerText = 'Please select a valid medicine from the list.';
    drugInput.focus();
    return;
  }

  if (!qty || qty <= 0) {
    msg.style.color = '#dc2626';
    msg.innerText = 'Please enter a valid quantity.';
    qtyInput.focus();
    return;
  }

  if (qty > selectedStock.available_qty) {
    msg.style.color = '#dc2626';
    msg.innerText = `Only ${selectedStock.available_qty} units available.`;
    qtyInput.focus();
    return;
  }

  const existingIndex = currentCart.findIndex((i) => i.batch_id === selectedStock.batch_id);
  if (existingIndex > -1) {
    if (currentCart[existingIndex].quantity + qty > selectedStock.available_qty) {
      msg.style.color = '#dc2626';
      msg.innerText = `Cannot exceed total batch stock (${selectedStock.available_qty}).`;
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
  drugInput.value = '';
  qtyInput.value = '1';
  renderCart();
  drugInput.focus();
}

const addToCartBtn = document.getElementById('add-to-cart-btn');
if (addToCartBtn) {
  addToCartBtn.addEventListener('click', handleAddToCart);
}

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
      await loadPosStock();
      await refreshAlertBadges();
      document.getElementById('pos_drug_input').focus();
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;
    }
  });
}

// Cashier Keyboard Shortcuts
const posDrugInput = document.getElementById('pos_drug_input');
if (posDrugInput) {
  posDrugInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const qtyInput = document.getElementById('pos_qty');
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    }
  });
}

const posQtyInput = document.getElementById('pos_qty');
if (posQtyInput) {
  posQtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddToCart();
    }
  });
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'F8') {
    e.preventDefault();
    const btn = document.getElementById('checkout-btn');
    if (btn) btn.click();
  }
});

// ==================== SALES HISTORY MODULE ====================
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

const closeModalBtn = document.getElementById('close-modal-btn');
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    document.getElementById('receipt-modal').style.display = 'none';
  });
}

const refreshSalesBtn = document.getElementById('refresh-sales-btn');
if (refreshSalesBtn) {
  refreshSalesBtn.addEventListener('click', loadSalesHistory);
}

// ==================== REPORTS & CHARTS MODULE ====================
async function loadAnalyticsDashboard() {
  const res = await window.api.getAnalytics();
  if (!res.success) return;

  analyticsCache = res.data;

  document.getElementById('kpi-today-rev').innerText = `LKR ${analyticsCache.kpis.today.today_revenue.toFixed(2)}`;
  document.getElementById('kpi-today-orders').innerText = `${analyticsCache.kpis.today.today_orders} transactions`;

  document.getElementById('kpi-month-rev').innerText = `LKR ${analyticsCache.kpis.month.month_revenue.toFixed(2)}`;
  document.getElementById('kpi-month-orders').innerText = `${analyticsCache.kpis.month.month_orders} transactions`;

  document.getElementById('kpi-total-rev').innerText = `LKR ${analyticsCache.kpis.total.all_time_revenue.toFixed(2)}`;
  document.getElementById('kpi-total-orders').innerText = `${analyticsCache.kpis.total.all_time_orders} transactions`;

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

const filterButtons = document.querySelectorAll('.filter-btn');
filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterButtons.forEach((b) => b.classList.remove('active-filter'));
    btn.classList.add('active-filter');
    const period = btn.getAttribute('data-period');
    renderSalesChart(period);
  });
});

// ==================== ALERTS BADGE MODULE ====================
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


// CSV Export Handler
const exportCsvBtn = document.getElementById('export-csv-btn');
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', async () => {
    const res = await window.api.exportCSV();
    if (res.success) {
      alert('✓ Inventory exported to CSV successfully!');
    } else if (!res.canceled) {
      alert('✗ Failed to export CSV: ' + res.error);
    }
  });
}

// Database Backup Handler
const backupDbBtn = document.getElementById('backup-db-btn');
if (backupDbBtn) {
  backupDbBtn.addEventListener('click', async () => {
    const res = await window.api.backupDatabase();
    if (res.success) {
      alert('✓ SQLite database backup saved successfully!');
    } else if (!res.canceled) {
      alert('✗ Failed to create backup: ' + res.error);
    }
  });
}


// ==================== RESET SYSTEM & INVENTORY DELETION ====================

// Load medicines into dropdown for deletion
async function loadDeleteDrugDropdown() {
  const select = document.getElementById('delete_drug_select');
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

// Button: Delete Selected Medicine Only
const deleteSelectedDrugBtn = document.getElementById('delete-selected-drug-btn');
if (deleteSelectedDrugBtn) {
  deleteSelectedDrugBtn.addEventListener('click', async () => {
    const select = document.getElementById('delete_drug_select');
    const msg = document.getElementById('delete-drug-status-msg');
    const drugId = parseInt(select.value, 10);

    if (!drugId) {
      msg.style.color = '#dc2626';
      msg.innerText = 'Please select a medicine from the list.';
      return;
    }

    const selectedName = select.options[select.selectedIndex].text;
    const confirmDelete = confirm(`Are you sure you want to remove "${selectedName}" from inventory? Sales history will remain intact.`);
    if (!confirmDelete) return;

    msg.style.color = '#475569';
    msg.innerText = 'Deleting medicine...';

    const res = await window.api.deleteMedicineKeepSales(drugId);
    if (res.success) {
      msg.style.color = '#16a34a';
      msg.innerText = '✓ Medicine removed from inventory!';
      await loadDeleteDrugDropdown();
      if (typeof displayDrugDropdown === 'function') await displayDrugDropdown();
      await refreshAlertBadges();
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;
    }
  });
}

// Button: Delete All Medicines (Keep Sales)
const deleteAllDrugsBtn = document.getElementById('delete-all-drugs-btn');
if (deleteAllDrugsBtn) {
  deleteAllDrugsBtn.addEventListener('click', async () => {
    const msg = document.getElementById('delete-all-drugs-msg');
    const confirmClear = confirm('Are you sure you want to delete ALL medicines and stock? (Past sales and revenue reports will NOT be deleted).');
    if (!confirmClear) return;

    msg.style.color = '#475569';
    msg.innerText = 'Clearing all medicines...';

    const res = await window.api.deleteAllMedicinesKeepSales();
    if (res.success) {
      msg.style.color = '#16a34a';
      msg.innerText = '✓ All medicines and stocks cleared!';
      await loadDeleteDrugDropdown();
      if (typeof displayDrugDropdown === 'function') await displayDrugDropdown();
      await refreshAlertBadges();
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;
    }
  });
}

// Button: Factory Reset (Wipe Everything)
const wipeDatabaseBtn = document.getElementById('wipe-database-btn');
if (wipeDatabaseBtn) {
  wipeDatabaseBtn.addEventListener('click', async () => {
    const pinInput = document.getElementById('admin-pin-confirm');
    const msg = document.getElementById('wipe-status-msg');

    if (!pinInput || pinInput.value !== '1234') {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Invalid PIN. Enter 1234 to proceed.';
      return;
    }

    const confirmFinal = confirm('Are you 100% sure? ALL medicines, batches, AND sales history will be permanently wiped.');
    if (!confirmFinal) return;

    msg.style.color = '#475569';
    msg.innerText = 'Wiping complete database...';

    const res = await window.api.clearInventory();
    if (res.success) {
      msg.style.color = '#16a34a';
      msg.innerText = '✓ Complete system wiped successfully!';
      pinInput.value = '';
      await loadDeleteDrugDropdown();
      if (typeof displayDrugDropdown === 'function') await displayDrugDropdown();
      await refreshAlertBadges();

      setTimeout(() => {
        msg.innerText = '';
      }, 2000);
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;

      setTimeout(() => {
        msg.innerText = '';
      }, 2000);
    }
  });
}