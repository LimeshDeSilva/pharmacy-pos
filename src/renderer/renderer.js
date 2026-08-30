// ==================== APP INITIALIZATION & STATE ====================
let availablePosStock = [];
let currentCart = [];
let registeredDrugsList = [];
let rawInventoryData = [];
let salesChartInstance = null;
let analyticsCache = null;
let profitChartInstance = null;
let profitAnalyticsCache = null;
let currentActiveShift = null;

let currentSettings = {
  pharmacy_name: 'NEW SAHASNA PHARMACY',
  pharmacy_address: 'No.514, Walagedara, Balapitiya',
  pharmacy_phone: '077-6723395'
};

const viewTitles = {
  'add-drug-view': 'Register Medicine',
  'add-batch-view': 'Add Batch',
  'inventory-view': 'Inventory Overview',
  'pos-view': 'Billing (POS)',
  'till-view': 'Till & Shift Management',
  'sales-view': 'Sales History',
  'reports-view': 'Reports & Charts',
  'profits-view': 'Profits & Charts',
  'settings-view': 'Pharmacy Details',
  'clear-inventory-view': 'System Reset & Wipe'
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadStoreSettings();
    await refreshAlertBadges();
    await checkActiveShiftStatus();
    if (typeof displayDrugDropdown === 'function') {
      await displayDrugDropdown();
    }
    const bInput = document.getElementById('brand_name');
    if (bInput) bInput.focus();
  } catch (err) {
    console.error('Failed to initialize app on startup:', err);
  }
});

// ==================== SIDEBAR TAB NAVIGATION ====================
const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');
const pageTitle = document.getElementById('page-title');

function navigateToTab(targetViewId, customMessage = '') {
  navItems.forEach((nav) => nav.classList.remove('active'));
  const targetNav = document.querySelector(`.nav-item[data-view="${targetViewId}"]`);
  if (targetNav) targetNav.classList.add('active');

  viewPanels.forEach((panel) => panel.classList.remove('active'));
  const activePanel = document.getElementById(targetViewId);
  if (activePanel) {
    activePanel.classList.add('active');
  }

  if (pageTitle && viewTitles[targetViewId]) {
    pageTitle.innerText = viewTitles[targetViewId];
  }

  refreshAlertBadges();

  if (targetViewId === 'add-drug-view') {
    setTimeout(() => {
      const bInput = document.getElementById('brand_name');
      if (bInput) { bInput.focus(); bInput.select(); }
    }, 50);
  } else if (targetViewId === 'add-batch-view') {
    displayDrugDropdown();
    setTimeout(() => {
      const bDrugInput = document.getElementById('batch_drug_input');
      if (bDrugInput) { bDrugInput.focus(); bDrugInput.select(); }
    }, 50);
  } else if (targetViewId === 'pos-view') {
    loadPosStock();
    setTimeout(() => {
      const pInput = document.getElementById('pos_drug_input');
      if (pInput) { pInput.focus(); pInput.select(); }
    }, 50);
  } else if (targetViewId === 'till-view') {
    loadTillManagementView(customMessage);
  } else if (targetViewId === 'inventory-view') {
    loadInventory();
  } else if (targetViewId === 'sales-view') {
    loadSalesHistory();
  } else if (targetViewId === 'reports-view') {
    loadAnalyticsDashboard();
  } else if (targetViewId === 'profits-view') {
    loadProfitAnalyticsDashboard();
  } else if (targetViewId === 'settings-view') {
    loadStoreSettings();
  } else if (targetViewId === 'clear-inventory-view') {
    loadDeleteDrugDropdown();
  }
}

navItems.forEach((item) => {
  item.addEventListener('click', async (e) => {
    const targetViewId = item.getAttribute('data-view');

    // TILL GATEKEEPER: Non-blocking check before entering POS Billing
    if (targetViewId === 'pos-view') {
      await checkActiveShiftStatus();
      if (!currentActiveShift) {
        navigateToTab('till-view', '⚠️ Till is currently CLOSED. Please enter starting cash float and open till shift first.');
        return;
      }
    }

    navigateToTab(targetViewId);
  });
});

// ==================== TILL / SHIFT MANAGEMENT MODULE ====================
async function checkActiveShiftStatus() {
  const indicator = document.getElementById('header-shift-indicator');
  if (!window.api || !window.api.getActiveShift) return;

  const res = await window.api.getActiveShift();
  if (res && res.success && res.data) {
    currentActiveShift = res.data;
    if (indicator) {
      indicator.innerText = `🟢 Till: Open (#${currentActiveShift.id})`;
      indicator.style.color = '#15803d';
      indicator.style.backgroundColor = '#dcfce7';
      indicator.style.borderColor = '#86efac';
    }
  } else {
    currentActiveShift = null;
    if (indicator) {
      indicator.innerText = '🔴 Till: Closed';
      indicator.style.color = '#dc2626';
      indicator.style.backgroundColor = '#fee2e2';
      indicator.style.borderColor = '#fecaca';
    }
  }
}

async function loadTillManagementView(customMessage = '') {
  await checkActiveShiftStatus();
  const openSection = document.getElementById('till-open-section');
  const closeSection = document.getElementById('till-close-section');
  const msg = document.getElementById('till-status-msg');

  if (msg) {
    if (customMessage) {
      msg.style.color = '#dc2626';
      msg.innerText = customMessage;
    } else {
      msg.innerText = '';
    }
  }

  if (currentActiveShift) {
    if (openSection) openSection.style.display = 'none';
    if (closeSection) closeSection.style.display = 'block';

    const liveRes = await window.api.getTillLiveStats(currentActiveShift.id);
    if (liveRes && liveRes.success) {
      const stats = liveRes.data;
      document.getElementById('active-shift-id').innerText = stats.shiftId;
      document.getElementById('active-shift-opened').innerText = stats.opened_at;
      document.getElementById('active-shift-float').innerText = `LKR ${Number(stats.opening_float).toFixed(2)}`;
      document.getElementById('active-shift-sales').innerText = `LKR ${Number(stats.total_sales).toFixed(2)}`;
      document.getElementById('active-shift-expected').innerText = `LKR ${Number(stats.expected_cash).toFixed(2)}`;
    }

    setTimeout(() => {
      const actualInp = document.getElementById('till_counted_cash');
      if (actualInp) { actualInp.focus(); actualInp.select(); }
    }, 100);
  } else {
    if (openSection) openSection.style.display = 'block';
    if (closeSection) closeSection.style.display = 'none';

    setTimeout(() => {
      const floatInp = document.getElementById('till_opening_float');
      if (floatInp) { floatInp.focus(); floatInp.select(); }
    }, 100);
  }

  await loadShiftsHistoryTable();
}

async function loadShiftsHistoryTable() {
  const tbody = document.getElementById('till-history-body');
  if (!tbody) return;

  const res = await window.api.getAllShifts();
  if (res && res.success) {
    if (res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 15px;">No shift history recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    res.data.forEach((s) => {
      const tr = document.createElement('tr');
      const isClosed = s.status === 'CLOSED';
      const varianceColor = s.variance < 0 ? '#dc2626' : (s.variance > 0 ? '#0284c7' : '#16a34a');

      tr.innerHTML = `
        <td><strong>#${s.id}</strong></td>
        <td><small>${s.opened_at}</small></td>
        <td><small>${s.closed_at || '<span style="color:#16a34a; font-weight: bold;">ACTIVE</span>'}</small></td>
        <td>${Number(s.opening_float).toFixed(2)}</td>
        <td>${Number(s.total_sales).toFixed(2)}</td>
        <td><strong>${Number(s.expected_cash).toFixed(2)}</strong></td>
        <td>${isClosed ? Number(s.actual_cash).toFixed(2) : '-'}</td>
        <td style="font-weight: bold; color: ${varianceColor};">${isClosed ? Number(s.variance).toFixed(2) : '-'}</td>
        <td>
          <span class="badge ${isClosed ? 'badge-expired' : 'badge-in-stock'}">${s.status}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Open Shift Form Handler
const tillOpenForm = document.getElementById('till-open-form');
if (tillOpenForm) {
  tillOpenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const floatInp = document.getElementById('till_opening_float');
    const msg = document.getElementById('till-status-msg');

    const floatVal = parseFloat(floatInp.value) || 0;
    msg.style.color = '#475569';
    msg.innerText = 'Opening till register...';

    const res = await window.api.openShift(floatVal);
    if (res && res.success) {
      msg.style.color = '#16a34a';
      msg.innerText = '✓ Till shift opened successfully!';
      floatInp.value = '';
      await checkActiveShiftStatus();
      await loadTillManagementView();

      setTimeout(() => {
        navigateToTab('pos-view');
      }, 700);
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;
    }
  });
}

// Close Shift Form Handler
const tillCloseForm = document.getElementById('till-close-form');
if (tillCloseForm) {
  tillCloseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentActiveShift) return;

    const actualCashInp = document.getElementById('till_counted_cash');
    const noteInp = document.getElementById('till_close_note');
    const msg = document.getElementById('till-status-msg');

    const payload = {
      shiftId: currentActiveShift.id,
      actualCash: parseFloat(actualCashInp.value) || 0,
      note: noteInp ? noteInp.value.trim() : ''
    };

    msg.style.color = '#475569';
    msg.innerText = 'Closing shift & generating Z-Report...';

    const res = await window.api.closeShift(payload);
    if (res && res.success) {
      msg.style.color = '#16a34a';
      msg.innerText = '✓ Till closed successfully! Printing closing summary...';

      await window.api.printTillReport({
        ...res.data,
        pharmacyName: currentSettings.pharmacy_name,
        pharmacyAddress: currentSettings.pharmacy_address,
        pharmacyPhone: currentSettings.pharmacy_phone
      });

      actualCashInp.value = '';
      if (noteInp) noteInp.value = '';

      await checkActiveShiftStatus();
      await loadTillManagementView();
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;
    }
  });
}

const refreshShiftsBtn = document.getElementById('refresh-shifts-btn');
if (refreshShiftsBtn) {
  refreshShiftsBtn.addEventListener('click', loadShiftsHistoryTable);
}

// ==================== STORE SETTINGS MODULE ====================
async function loadStoreSettings() {
  if (!window.api || typeof window.api.getSettings !== 'function') return;

  const res = await window.api.getSettings();
  if (res && res.success) {
    currentSettings = res.data;

    const nameInp = document.getElementById('setting_pharmacy_name');
    const addrInp = document.getElementById('setting_pharmacy_address');
    const phoneInp = document.getElementById('setting_pharmacy_phone');

    if (nameInp) nameInp.value = currentSettings.pharmacy_name || '';
    if (addrInp) addrInp.value = currentSettings.pharmacy_address || '';
    if (phoneInp) phoneInp.value = currentSettings.pharmacy_phone || '';
  }
}

const settingsForm = document.getElementById('settings-form');
if (settingsForm) {
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const msg = document.getElementById('settings-status-msg');
    const payload = {
      pharmacy_name: document.getElementById('setting_pharmacy_name').value.trim(),
      pharmacy_address: document.getElementById('setting_pharmacy_address').value.trim(),
      pharmacy_phone: document.getElementById('setting_pharmacy_phone').value.trim()
    };

    msg.style.color = '#475569';
    msg.innerText = 'Saving pharmacy details...';

    const res = await window.api.updateSettings(payload);
    if (res.success) {
      currentSettings = payload;
      msg.style.color = '#16a34a';
      msg.innerText = '✓ Pharmacy details updated successfully!';
      setTimeout(() => { msg.innerText = ''; }, 2500);
    } else {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + res.error;
    }
  });
}

// ==================== ADD MEDICINE MODULE ====================
const drugForm = document.getElementById('drug-form');
const drugStatusMsg = document.getElementById('drug-status-msg');
const brandInput = document.getElementById('brand_name');
const genericInput = document.getElementById('generic_name');
const categoryInput = document.getElementById('category');
const minStockInput = document.getElementById('min_stock_alert');

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

      if (brandInput) brandInput.focus();
      setTimeout(() => { drugStatusMsg.innerText = ''; }, 2000);
    } else {
      drugStatusMsg.style.color = '#dc2626';
      drugStatusMsg.innerText = '✗ Error: ' + response.error;
      setTimeout(() => { drugStatusMsg.innerText = ''; }, 2000);
    }
  });
}

if (brandInput) {
  brandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (genericInput) { genericInput.focus(); genericInput.select(); } }
  });
}
if (genericInput) {
  genericInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (categoryInput) { categoryInput.focus(); categoryInput.select(); } }
  });
}
if (categoryInput) {
  categoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (minStockInput) { minStockInput.focus(); minStockInput.select(); } }
  });
}
if (minStockInput) {
  minStockInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (drugForm) drugForm.requestSubmit(); }
  });
}

// ==================== ADD BATCH MODULE ====================
let batchDropIndex = 0;
let batchDropMatches = [];

async function displayDrugDropdown() {
  const res = await window.api.getAllDrugs();
  if (res && res.success) {
    registeredDrugsList = res.data;
  }
}

function showBatchDrugList(q = '') {
  const menu = document.getElementById('batch-dropdown');
  if (!menu) return;

  const term = q.toLowerCase().trim();
  if (!term) {
    menu.style.display = 'none';
    return;
  }

  batchDropMatches = registeredDrugsList.filter((d) =>
    d.brand_name.toLowerCase().includes(term) ||
    (d.generic_name && d.generic_name.toLowerCase().includes(term)) ||
    (d.category && d.category.toLowerCase().includes(term))
  );

  if (batchDropMatches.length === 0) {
    menu.style.display = 'none';
    return;
  }

  batchDropIndex = 0;
  menu.innerHTML = batchDropMatches.map((d, i) => `
    <div class="pos-option ${i === 0 ? 'selected' : ''}" data-idx="${i}">
      <strong>${d.brand_name}</strong> <span style="color: #64748b;">(${d.generic_name || 'N/A'})</span> — <small style="color: #0284c7;">[${d.category || 'General'}]</small>
    </div>
  `).join('');

  menu.querySelectorAll('.pos-option').forEach((el) => {
    el.addEventListener('click', () => pickBatchDrug(batchDropMatches[el.dataset.idx]));
  });

  menu.style.display = 'block';
}

function pickBatchDrug(drug) {
  const input = document.getElementById('batch_drug_input');
  const hiddenId = document.getElementById('selected_batch_drug_id');
  const menu = document.getElementById('batch-dropdown');
  const nextInput = document.getElementById('batch_number');

  if (input) input.value = `${drug.brand_name} (${drug.generic_name || 'N/A'})`;
  if (hiddenId) hiddenId.value = drug.id;
  if (menu) menu.style.display = 'none';

  if (nextInput) { nextInput.focus(); nextInput.select(); }
}

const batchDrugInputEl = document.getElementById('batch_drug_input');
if (batchDrugInputEl) {
  batchDrugInputEl.addEventListener('input', () => {
    document.getElementById('selected_batch_drug_id').value = '';
    showBatchDrugList(batchDrugInputEl.value);
  });

  batchDrugInputEl.addEventListener('keydown', (e) => {
    const menu = document.getElementById('batch-dropdown');
    const items = menu ? menu.querySelectorAll('.pos-option') : [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) {
        batchDropIndex = (batchDropIndex + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === batchDropIndex));
        items[batchDropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) {
        batchDropIndex = (batchDropIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === batchDropIndex));
        items[batchDropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (menu && menu.style.display !== 'none' && batchDropMatches[batchDropIndex]) {
        pickBatchDrug(batchDropMatches[batchDropIndex]);
      } else {
        const next = document.getElementById('batch_number');
        if (next) next.focus();
      }
    } else if (e.key === 'Escape') {
      if (menu) menu.style.display = 'none';
    }
  });
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('batch-dropdown');
  if (menu && !menu.contains(e.target) && e.target !== batchDrugInputEl) {
    menu.style.display = 'none';
  }
});

const batchForm = document.getElementById('batch-form');
const batchStatusMsg = document.getElementById('batch-status-msg');

if (batchForm) {
  batchForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const selectedDrugId = parseInt(document.getElementById('selected_batch_drug_id').value, 10);
    const drugInput = document.getElementById('batch_drug_input');

    if (!selectedDrugId) {
      batchStatusMsg.style.color = '#dc2626';
      batchStatusMsg.innerText = '✗ Please select a registered medicine from the dropdown list.';
      if (drugInput) drugInput.focus();
      return;
    }

    const batchData = {
      drug_id: selectedDrugId,
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
      document.getElementById('selected_batch_drug_id').value = '';
      await refreshAlertBadges();

      if (drugInput) drugInput.focus();
      setTimeout(() => { batchStatusMsg.innerText = ''; }, 2000);
    } else {
      batchStatusMsg.style.color = '#dc2626';
      batchStatusMsg.innerText = '✗ Error: ' + response.error;
      setTimeout(() => { batchStatusMsg.innerText = ''; }, 3000);
    }
  });
}

const batchNoInput = document.getElementById('batch_number');
const expiryDateInput = document.getElementById('expiry_date');
const buyPriceInput = document.getElementById('buy_price');
const sellPriceInput = document.getElementById('sell_price');
const batchQtyInput = document.getElementById('quantity');

if (batchNoInput) {
  batchNoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (expiryDateInput) expiryDateInput.focus(); }
  });
}
if (expiryDateInput) {
  expiryDateInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (buyPriceInput) { buyPriceInput.focus(); buyPriceInput.select(); } }
  });
}
if (buyPriceInput) {
  buyPriceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (sellPriceInput) { sellPriceInput.focus(); sellPriceInput.select(); } }
  });
}
if (sellPriceInput) {
  sellPriceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (batchQtyInput) { batchQtyInput.focus(); batchQtyInput.select(); } }
  });
}
if (batchQtyInput) {
  batchQtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (batchForm) batchForm.requestSubmit(); }
  });
}

// ==================== INVENTORY OVERVIEW & FILTER MODULE ====================
function calculateItemStatus(row) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  thirtyDaysFromNow.setHours(23, 59, 59, 999);

  const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;

  if (expiryDate && expiryDate < today) {
    return { type: 'EXPIRED', badge: '<span class="badge badge-expired">Expired</span>' };
  }
  if (expiryDate && expiryDate >= today && expiryDate <= thirtyDaysFromNow) {
    return { type: 'EXPIRING_SOON', badge: '<span class="badge badge-expiring">Expiring Soon</span>' };
  }
  if (row.total_stock === 0) {
    return { type: 'OUT_OF_STOCK', badge: '<span class="badge badge-out-of-stock">Out of Stock</span>' };
  }
  if (row.total_stock <= row.min_stock_alert) {
    return { type: 'LOW_STOCK', badge: '<span class="badge badge-low-stock">Low Stock</span>' };
  }
  return { type: 'IN_STOCK', badge: '<span class="badge badge-in-stock">In Stock</span>' };
}

function renderInventoryTable() {
  const tableBody = document.getElementById('inventory-table-body');
  const filterSelect = document.getElementById('inventory-filter');
  const searchInput = document.getElementById('inventory-search');
  if (!tableBody) return;

  const activeFilter = filterSelect ? filterSelect.value : 'ALL';
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  if (!rawInventoryData || rawInventoryData.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 20px;">No inventory records found.</td></tr>`;
    return;
  }

  const filteredData = rawInventoryData.filter((row) => {
    const status = calculateItemStatus(row);
    const matchesFilter = activeFilter === 'ALL' || status.type === activeFilter;
    const matchesSearch =
      !searchTerm ||
      (row.brand_name && String(row.brand_name).toLowerCase().includes(searchTerm)) ||
      (row.generic_name && String(row.generic_name).toLowerCase().includes(searchTerm)) ||
      (row.category && String(row.category).toLowerCase().includes(searchTerm)) ||
      (row.batch_number && String(row.batch_number).toLowerCase().includes(searchTerm));

    return matchesFilter && matchesSearch;
  });

  if (filteredData.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 20px;">No medicines match your search / filter criteria.</td></tr>`;
    return;
  }

  tableBody.innerHTML = '';
  filteredData.forEach((row) => {
    const status = calculateItemStatus(row);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${row.brand_name}</strong></td>
      <td>${row.generic_name || '-'}</td>
      <td>${row.category || '-'}</td>
      <td>${row.batch_number ? `<code>${row.batch_number}</code>` : '<span style="color: #94a3b8;">No Batches</span>'}</td>
      <td>${row.expiry_date || '-'}</td>
      <td>${row.sell_price ? Number(row.sell_price).toFixed(2) : '-'}</td>
      <td>${row.batch_quantity !== null ? row.batch_quantity : 0}</td>
      <td><strong>${row.total_stock}</strong></td>
      <td>${status.badge}</td>
      <td>
        <button onclick="openEditItemModal(${row.drug_id}, ${row.batch_id || 'null'})" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">✏️ Edit</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function loadInventory() {
  const response = await window.api.getInventory();
  if (response.success) {
    rawInventoryData = response.data;
    renderInventoryTable();
  }
}

const inventorySearchInput = document.getElementById('inventory-search');
if (inventorySearchInput) inventorySearchInput.addEventListener('input', renderInventoryTable);

const inventoryFilterSelect = document.getElementById('inventory-filter');
if (inventoryFilterSelect) inventoryFilterSelect.addEventListener('change', renderInventoryTable);

const refreshInventoryBtn = document.getElementById('refresh-inventory-btn');
if (refreshInventoryBtn) refreshInventoryBtn.addEventListener('click', loadInventory);

// ==================== EDIT ITEM MODAL HANDLERS ====================
window.openEditItemModal = (drugId, batchId) => {
  const item = rawInventoryData.find((d) => d.drug_id === drugId && (batchId ? d.batch_id === batchId : true));
  if (!item) return;

  document.getElementById('edit_drug_id').value = item.drug_id;
  document.getElementById('edit_brand_name').value = item.brand_name || '';
  document.getElementById('edit_generic_name').value = item.generic_name || '';
  document.getElementById('edit_category').value = item.category || '';
  document.getElementById('edit_min_stock_alert').value = item.min_stock_alert || 10;

  const batchSection = document.getElementById('edit-batch-section');
  if (item.batch_id) {
    batchSection.style.display = 'block';
    document.getElementById('edit_batch_id').value = item.batch_id;
    document.getElementById('edit_batch_number').value = item.batch_number || '';
    document.getElementById('edit_expiry_date').value = item.expiry_date || '';
    document.getElementById('edit_buy_price').value = item.buy_price !== null ? item.buy_price : '';
    document.getElementById('edit_sell_price').value = item.sell_price !== null ? item.sell_price : '';
    document.getElementById('edit_quantity').value = item.batch_quantity !== null ? item.batch_quantity : 0;
  } else {
    batchSection.style.display = 'none';
    document.getElementById('edit_batch_id').value = '';
  }

  document.getElementById('edit-drug-status-msg').innerText = '';
  const modal = document.getElementById('edit-drug-modal');
  if (modal) modal.style.display = 'flex';
};

function closeEditItemModal() {
  const modal = document.getElementById('edit-drug-modal');
  if (modal) modal.style.display = 'none';
}

const closeEditBtn = document.getElementById('close-edit-drug-modal');
if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditItemModal);

const cancelEditBtn = document.getElementById('cancel-edit-drug-btn');
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditItemModal);

const editItemForm = document.getElementById('edit-drug-form');
if (editItemForm) {
  editItemForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const statusMsg = document.getElementById('edit-drug-status-msg');
    const batchIdVal = document.getElementById('edit_batch_id').value;

    const payload = {
      drug_id: parseInt(document.getElementById('edit_drug_id').value, 10),
      brand_name: document.getElementById('edit_brand_name').value.trim(),
      generic_name: document.getElementById('edit_generic_name').value.trim(),
      category: document.getElementById('edit_category').value.trim(),
      min_stock_alert: parseInt(document.getElementById('edit_min_stock_alert').value, 10) || 10,
      batch_id: batchIdVal ? parseInt(batchIdVal, 10) : null,
      batch_number: document.getElementById('edit_batch_number').value.trim(),
      expiry_date: document.getElementById('edit_expiry_date').value,
      buy_price: parseFloat(document.getElementById('edit_buy_price').value) || 0,
      sell_price: parseFloat(document.getElementById('edit_sell_price').value) || 0,
      quantity: parseInt(document.getElementById('edit_quantity').value, 10) || 0
    };

    statusMsg.style.color = '#475569';
    statusMsg.innerText = 'Updating details...';

    const res = await window.api.updateInventoryItem(payload);
    if (res.success) {
      statusMsg.style.color = '#16a34a';
      statusMsg.innerText = '✓ All details updated successfully!';
      await loadInventory();
      if (typeof displayDrugDropdown === 'function') await displayDrugDropdown();
      await refreshAlertBadges();
      setTimeout(() => { closeEditItemModal(); }, 700);
    } else {
      statusMsg.style.color = '#dc2626';
      statusMsg.innerText = '✗ Error: ' + res.error;
    }
  });
}

// ==================== POS / BILLING MODULE ====================
let dropIndex = 0;
let dropMatches = [];

async function loadPosStock() {
  const expiryAlert = document.getElementById('pos-expiry-alert');
  if (expiryAlert) expiryAlert.style.display = 'none';

  const res = await window.api.getPosStock();
  if (res.success) {
    availablePosStock = res.data;
  }
}

function showList(q = '') {
  const menu = document.getElementById('pos-dropdown');
  if (!menu) return;

  const term = q.toLowerCase().trim();
  if (!term) {
    menu.style.display = 'none';
    return;
  }

  dropMatches = availablePosStock.filter((d) =>
    d.brand_name.toLowerCase().includes(term) ||
    (d.generic_name && d.generic_name.toLowerCase().includes(term)) ||
    d.batch_number.toLowerCase().includes(term)
  );

  if (dropMatches.length === 0) {
    menu.style.display = 'none';
    return;
  }

  dropIndex = 0;
  menu.innerHTML = dropMatches.map((d, i) => `
    <div class="pos-option ${i === 0 ? 'selected' : ''}" data-idx="${i}">
      ${d.brand_name} | Batch: <code>${d.batch_number}</code> | Stock: ${d.available_qty} | <strong>LKR ${d.sell_price.toFixed(2)}</strong>
    </div>
  `).join('');

  menu.querySelectorAll('.pos-option').forEach((el) => {
    el.addEventListener('click', () => pickItem(dropMatches[el.dataset.idx]));
  });

  menu.style.display = 'block';
}

function pickItem(item) {
  const input = document.getElementById('pos_drug_input');
  const menu = document.getElementById('pos-dropdown');
  const qty = document.getElementById('pos_qty');

  input.value = `${item.brand_name} | Batch: ${item.batch_number} | Exp: ${item.expiry_date} | Stock: ${item.available_qty} | LKR ${item.sell_price.toFixed(2)}`;
  if (menu) menu.style.display = 'none';
  checkSelectedBatchExpiry();
  if (qty) { qty.focus(); qty.select(); }
}

// Sequential '+' Key Shortcut: Cart -> Discount (%) -> Cash Paid
window.addEventListener('keydown', (e) => {
  const isPosView = document.getElementById('pos-view')?.classList.contains('active');
  if (isPosView && (e.key === '+' || e.code === 'NumpadAdd')) {
    const discountInput = document.getElementById('pos-discount-amount');
    const paidInput = document.getElementById('pos-paid-amount');

    if (document.activeElement !== discountInput && document.activeElement !== paidInput) {
      e.preventDefault();
      if (discountInput) { discountInput.focus(); discountInput.select(); }
    } else if (document.activeElement === discountInput) {
      e.preventDefault();
      if (paidInput) { paidInput.focus(); paidInput.select(); }
    }
  }
});

function checkSelectedBatchExpiry() {
  const drugInput = document.getElementById('pos_drug_input');
  const expiryAlert = document.getElementById('pos-expiry-alert');
  if (!drugInput || !expiryAlert) return;

  const selectedText = drugInput.value.trim();
  const selectedStock = availablePosStock.find(
    (item) => selectedText.includes(item.batch_number) && selectedText.includes(item.brand_name)
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedStock && selectedStock.expiry_date && new Date(selectedStock.expiry_date) < today) {
    drugInput.style.borderColor = '#dc2626';
    drugInput.style.backgroundColor = '#fef2f2';
    expiryAlert.style.display = 'block';
    expiryAlert.innerHTML = `⚠️ <strong>WARNING:</strong> Batch <span style="text-decoration: underline;">${selectedStock.batch_number}</span> has <strong>EXPIRED</strong> on <strong>${selectedStock.expiry_date}</strong>!`;
  } else {
    drugInput.style.borderColor = '';
    drugInput.style.backgroundColor = '';
    expiryAlert.style.display = 'none';
  }
}

function calculatePosBalance() {
  const subtotal = currentCart.reduce((sum, item) => sum + item.total_price, 0);
  const discountInput = document.getElementById('pos-discount-amount');
  const paidInput = document.getElementById('pos-paid-amount');
  const totalDisplay = document.getElementById('grand-total-display');
  const balanceDisplay = document.getElementById('pos-balance-display');
  if (!paidInput || !balanceDisplay || !totalDisplay) return 0;

  const discountPercent = Math.max(0, Math.min(100, parseFloat(discountInput ? discountInput.value : 0) || 0));
  const discountVal = (subtotal * discountPercent) / 100;
  const netTotal = Math.max(0, subtotal - discountVal);

  totalDisplay.innerText = `LKR ${netTotal.toFixed(2)}`;

  const paidVal = parseFloat(paidInput.value) || 0;
  const balance = paidVal - netTotal;

  if (paidVal === 0 && netTotal === 0) {
    balanceDisplay.innerText = 'LKR 0.00';
    balanceDisplay.style.color = '#16a34a';
  } else if (balance < 0) {
    balanceDisplay.innerText = `- LKR ${Math.abs(balance).toFixed(2)}`;
    balanceDisplay.style.color = '#dc2626';
  } else {
    balanceDisplay.innerText = `LKR ${balance.toFixed(2)}`;
    balanceDisplay.style.color = '#16a34a';
  }

  return { subtotal, discountPercent, discountVal, netTotal, paidVal, balance };
}

const posDiscountInput = document.getElementById('pos-discount-amount');
if (posDiscountInput) {
  posDiscountInput.addEventListener('input', calculatePosBalance);
  posDiscountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const paidInput = document.getElementById('pos-paid-amount');
      if (paidInput) { paidInput.focus(); paidInput.select(); }
    }
  });
}

const posPaidInput = document.getElementById('pos-paid-amount');
if (posPaidInput) {
  posPaidInput.addEventListener('input', calculatePosBalance);
  posPaidInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processCheckout({ shouldPrint: false });
    }
  });
}

function renderCart() {
  const cartBody = document.getElementById('cart-table-body');
  const totalDisplay = document.getElementById('grand-total-display');
  if (!cartBody || !totalDisplay) return;

  if (currentCart.length === 0) {
    cartBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 14px;">Cart is empty.</td></tr>`;
    totalDisplay.innerText = 'LKR 0.00';
    const discountInput = document.getElementById('pos-discount-amount');
    const paidInput = document.getElementById('pos-paid-amount');
    if (discountInput) discountInput.value = '';
    if (paidInput) paidInput.value = '';
    calculatePosBalance();
    return;
  }

  cartBody.innerHTML = '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  currentCart.forEach((item, index) => {
    const isExpired = item.expiry_date && new Date(item.expiry_date) < today;

    const batchStyle = isExpired
      ? 'color: #dc2626; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 4px;'
      : 'color: #64748b;';
    const expiredBadge = isExpired
      ? '<span style="background: #dc2626; color: #fff; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">EXPIRED</span>'
      : '';

    const tr = document.createElement('tr');
    if (isExpired) tr.style.backgroundColor = '#fff5f5';

    tr.innerHTML = `
      <td>
        <strong>${item.brand_name}</strong> ${expiredBadge}<br>
        <small style="${batchStyle}">Batch: ${item.batch_number} | Exp: ${item.expiry_date || 'N/A'}</small>
      </td>
      <td>${item.sell_price.toFixed(2)}</td>
      <td>${item.quantity}</td>
      <td><strong>${item.total_price.toFixed(2)}</strong></td>
      <td><button onclick="removeFromCart(${index})" style="background: #fee2e2; color: #b91c1c; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✕</button></td>
    `;
    cartBody.appendChild(tr);
  });

  calculatePosBalance();
}

window.removeFromCart = (index) => {
  currentCart.splice(index, 1);
  renderCart();
};

function handleAddToCart() {
  if (!currentActiveShift) {
    navigateToTab('till-view', '⚠️ Till is closed. Please open a shift first.');
    return;
  }

  const drugInput = document.getElementById('pos_drug_input');
  const qtyInput = document.getElementById('pos_qty');
  const msg = document.getElementById('pos-input-msg');
  const expiryAlert = document.getElementById('pos-expiry-alert');

  const selectedText = drugInput.value.trim();
  const qty = parseInt(qtyInput.value, 10);

  const selectedStock = availablePosStock.find(
    (item) => selectedText.includes(item.batch_number) && selectedText.includes(item.brand_name)
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
      expiry_date: selectedStock.expiry_date,
      buy_price: parseFloat(selectedStock.buy_price) || 0,
      sell_price: parseFloat(selectedStock.sell_price) || 0,
      quantity: qty,
      total_price: qty * selectedStock.sell_price
    });
  }

  msg.innerText = '';
  drugInput.value = '';
  drugInput.style.borderColor = '';
  drugInput.style.backgroundColor = '';
  if (expiryAlert) expiryAlert.style.display = 'none';

  qtyInput.value = '1';
  renderCart();
  drugInput.focus();
}

const pInput = document.getElementById('pos_drug_input');
if (pInput) {
  pInput.addEventListener('input', () => {
    showList(pInput.value);
    checkSelectedBatchExpiry();
  });

  pInput.addEventListener('keydown', (e) => {
    const menu = document.getElementById('pos-dropdown');
    const items = menu ? menu.querySelectorAll('.pos-option') : [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) {
        dropIndex = (dropIndex + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === dropIndex));
        items[dropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) {
        dropIndex = (dropIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === dropIndex));
        items[dropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (menu && menu.style.display !== 'none' && dropMatches[dropIndex]) {
        pickItem(dropMatches[dropIndex]);
      } else {
        const qty = document.getElementById('pos_qty');
        if (qty) { qty.focus(); qty.select(); }
      }
    } else if (e.key === 'Escape') {
      if (menu) menu.style.display = 'none';
    }
  });
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('pos-dropdown');
  if (menu && !menu.contains(e.target) && e.target !== pInput) {
    menu.style.display = 'none';
  }
});

const addToCartBtn = document.getElementById('add-to-cart-btn');
if (addToCartBtn) addToCartBtn.addEventListener('click', handleAddToCart);

const posQtyInput = document.getElementById('pos_qty');
if (posQtyInput) {
  posQtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddToCart(); }
  });
}

// Global F8 Key Shortcut -> Complete Checkout AND Print
window.addEventListener('keydown', (e) => {
  const isPosView = document.getElementById('pos-view')?.classList.contains('active');
  if (isPosView && e.key === 'F8') {
    e.preventDefault();
    processCheckout({ shouldPrint: true });
  }
});

// ==================== SALES HISTORY MODULE ====================
let rawSalesData = [];

function renderSalesTable() {
  const tableBody = document.getElementById('sales-table-body');
  const revenueBanner = document.getElementById('total-revenue-banner');
  const dateInput = document.getElementById('sales-date-filter');
  const searchInput = document.getElementById('sales-invoice-search');
  if (!tableBody) return;

  const selectedDate = dateInput ? dateInput.value : '';
  const searchInvoiceId = searchInput ? searchInput.value.trim() : '';

  if (!rawSalesData || rawSalesData.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">No sales recorded yet.</td></tr>`;
    if (revenueBanner) revenueBanner.innerText = 'Total Revenue: LKR 0.00';
    return;
  }

  const filteredSales = rawSalesData.filter((sale) => {
    const saleIdStr = String(sale.sale_id || sale.id);
    const matchesSearch = !searchInvoiceId || saleIdStr === searchInvoiceId || saleIdStr.includes(searchInvoiceId);
    const matchesDate = !selectedDate || (sale.sale_date && sale.sale_date.startsWith(selectedDate));
    return matchesSearch && matchesDate;
  });

  if (filteredSales.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b; padding: 20px;">No matching sales found.</td></tr>`;
    if (revenueBanner) revenueBanner.innerText = `Total Revenue: LKR 0.00`;
    return;
  }

  tableBody.innerHTML = '';
  let cumulativeRevenue = 0;

  filteredSales.forEach((sale) => {
    cumulativeRevenue += sale.total_amount;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${sale.sale_id}</strong></td>
      <td>${sale.sale_date}</td>
      <td>${sale.item_count} items</td>
      <td><strong>LKR ${Number(sale.total_amount).toFixed(2)}</strong></td>
      <td>
        <button onclick="viewReceipt(${sale.sale_id})" style="background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; margin-right: 4px;">View Details</button>
        <button onclick="openEditSaleModal(${sale.sale_id})" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">🔄 Change/Exchange</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  if (revenueBanner) {
    revenueBanner.innerText = `Total Revenue: LKR ${cumulativeRevenue.toFixed(2)}`;
  }
}

async function loadSalesHistory() {
  const res = await window.api.getAllSales();
  if (res.success) {
    rawSalesData = res.data;
    renderSalesTable();
  }
}

const salesDateFilter = document.getElementById('sales-date-filter');
if (salesDateFilter) {
  salesDateFilter.addEventListener('input', renderSalesTable);
  salesDateFilter.addEventListener('change', renderSalesTable);
}

const salesTodayBtn = document.getElementById('sales-today-btn');
if (salesTodayBtn) {
  salesTodayBtn.addEventListener('click', () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    if (salesDateFilter) salesDateFilter.value = todayStr;
    renderSalesTable();
  });
}

const salesClearBtn = document.getElementById('sales-clear-filter-btn');
if (salesClearBtn) {
  salesClearBtn.addEventListener('click', () => {
    if (salesDateFilter) salesDateFilter.value = '';
    renderSalesTable();
  });
}

const salesInvoiceSearchInput = document.getElementById('sales-invoice-search');
if (salesInvoiceSearchInput) {
  salesInvoiceSearchInput.addEventListener('input', renderSalesTable);
}

let currentModalSale = null;

window.viewReceipt = async (saleId) => {
  const modal = document.getElementById('receipt-modal');
  const title = document.getElementById('modal-invoice-title');
  const itemsBody = document.getElementById('receipt-items-body');
  const discountRow = document.getElementById('modal-receipt-discount-row');
  const discountVal = document.getElementById('modal-receipt-discount-val');

  title.innerText = `Invoice Receipt #${saleId}`;
  itemsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 10px;">Loading...</td></tr>`;
  modal.style.display = 'flex';

  const res = await window.api.getSaleDetails(saleId);
  if (res.success) {
    const discount = res.data.length > 0 ? (res.data[0].sale_discount || 0) : 0;
    const subtotal = res.data.reduce((sum, i) => sum + i.total_price, 0);
    const netTotal = res.data.length > 0 && res.data[0].sale_net_total !== undefined ? res.data[0].sale_net_total : Math.max(0, subtotal - discount);

    currentModalSale = {
      id: saleId,
      items: res.data,
      subtotal: subtotal,
      discount: discount,
      total: netTotal
    };

    itemsBody.innerHTML = '';
    res.data.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item.brand_name}</strong></td>
        <td><code>${item.batch_number || '-'}</code></td>
        <td>${item.quantity}</td>
        <td>${Number(item.unit_price).toFixed(2)}</td>
        <td><strong>${Number(item.total_price).toFixed(2)}</strong></td>
      `;
      itemsBody.appendChild(tr);
    });

    if (discount > 0 && discountRow && discountVal) {
      discountRow.style.display = 'flex';
      discountVal.innerText = `- LKR ${Number(discount).toFixed(2)}`;
    } else if (discountRow) {
      discountRow.style.display = 'none';
    }
  }
};

const modalReprintBtn = document.getElementById('modal-reprint-btn');
if (modalReprintBtn) {
  modalReprintBtn.addEventListener('click', () => {
    if (currentModalSale) {
      printThermalReceipt(
        currentModalSale.id,
        new Date().toLocaleString(),
        currentModalSale.items,
        currentModalSale.total,
        currentModalSale.total,
        0,
        currentModalSale.discount,
        currentModalSale.subtotal
      );
    }
  });
}

const closeModalBtn = document.getElementById('close-modal-btn');
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => {
    document.getElementById('receipt-modal').style.display = 'none';
  });
}

const refreshSalesBtn = document.getElementById('refresh-sales-btn');
if (refreshSalesBtn) refreshSalesBtn.addEventListener('click', loadSalesHistory);

// ==================== REVENUES & CHARTS MODULE ====================
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

  if (salesChartInstance) salesChartInstance.destroy();

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
        y: { beginAtZero: true, ticks: { callback: (val) => `LKR ${val}` }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => ` Revenue: LKR ${Number(item.raw).toFixed(2)}` } }
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

// ==================== PROFIT ANALYTICS MODULE ====================
async function loadProfitAnalyticsDashboard() {
  const res = await window.api.getProfitAnalytics();
  if (!res || !res.success) return;

  profitAnalyticsCache = res.data;

  const today = profitAnalyticsCache.kpis.today || { profit: 0, orders: 0 };
  const month = profitAnalyticsCache.kpis.month || { profit: 0, orders: 0 };
  const total = profitAnalyticsCache.kpis.total || { profit: 0, orders: 0 };

  const todayEl = document.getElementById('kpi-today-profit');
  const todayOrdersEl = document.getElementById('kpi-today-profit-orders');
  const monthEl = document.getElementById('kpi-month-profit');
  const monthOrdersEl = document.getElementById('kpi-month-profit-orders');
  const totalEl = document.getElementById('kpi-total-profit');
  const totalOrdersEl = document.getElementById('kpi-total-profit-orders');

  if (todayEl) todayEl.innerText = `LKR ${Number(today.profit).toFixed(2)}`;
  if (todayOrdersEl) todayOrdersEl.innerText = `${today.orders} transactions`;

  if (monthEl) monthEl.innerText = `LKR ${Number(month.profit).toFixed(2)}`;
  if (monthOrdersEl) monthOrdersEl.innerText = `${month.orders} transactions`;

  if (totalEl) totalEl.innerText = `LKR ${Number(total.profit).toFixed(2)}`;
  if (totalOrdersEl) totalOrdersEl.innerText = `${total.orders} transactions`;

  renderProfitChart('daily');
}

function renderProfitChart(periodType = 'daily') {
  const canvas = document.getElementById('profitChart');
  if (!canvas || !profitAnalyticsCache) return;

  let dataset = [];
  let labelText = 'Daily Profit (LKR)';

  if (periodType === 'daily') {
    dataset = profitAnalyticsCache.daily || [];
    labelText = 'Daily Profit (LKR)';
  } else if (periodType === 'weekly') {
    dataset = profitAnalyticsCache.weekly || [];
    labelText = 'Weekly Profit (LKR)';
  } else if (periodType === 'monthly') {
    dataset = profitAnalyticsCache.monthly || [];
    labelText = 'Monthly Profit (LKR)';
  }

  const labels = dataset.length > 0 ? dataset.map((d) => d.period) : ['No Sales Recorded'];
  const data = dataset.length > 0 ? dataset.map((d) => d.total_profit) : [0];

  if (profitChartInstance) profitChartInstance.destroy();

  const ctx = canvas.getContext('2d');
  profitChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: labelText,
          data: data,
          backgroundColor: 'rgba(22, 163, 74, 0.85)',
          borderColor: '#16a34a',
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
        y: { beginAtZero: true, ticks: { callback: (val) => `LKR ${val}` }, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (item) => ` Profit: LKR ${Number(item.raw).toFixed(2)}` } }
      }
    }
  });
}

const profitFilterButtons = document.querySelectorAll('.profit-filter-btn');
profitFilterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    profitFilterButtons.forEach((b) => b.classList.remove('active-filter'));
    btn.classList.add('active-filter');
    const period = btn.getAttribute('data-period');
    renderProfitChart(period);
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
      badge.innerText = String(totalAlerts);
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
let deleteDropIndex = 0;
let deleteDropMatches = [];

async function loadDeleteDrugDropdown() {
  const res = await window.api.getAllDrugs();
  if (res && res.success) {
    registeredDrugsList = res.data;
  }
}

function showDeleteDrugList(q = '') {
  const menu = document.getElementById('delete-drug-dropdown');
  if (!menu) return;

  const term = q.toLowerCase().trim();
  if (!term) {
    menu.style.display = 'none';
    return;
  }

  deleteDropMatches = registeredDrugsList.filter((d) =>
    d.brand_name.toLowerCase().includes(term) ||
    (d.generic_name && d.generic_name.toLowerCase().includes(term)) ||
    (d.category && d.category.toLowerCase().includes(term))
  );

  if (deleteDropMatches.length === 0) {
    menu.style.display = 'none';
    return;
  }

  deleteDropIndex = 0;
  menu.innerHTML = deleteDropMatches.map((d, i) => `
    <div class="pos-option ${i === 0 ? 'selected' : ''}" data-idx="${i}">
      <strong>${d.brand_name}</strong> <span style="color: #64748b;">(${d.generic_name || 'N/A'})</span> — <small style="color: #0284c7;">[${d.category || 'General'}]</small>
    </div>
  `).join('');

  menu.querySelectorAll('.pos-option').forEach((el) => {
    el.addEventListener('click', () => pickDeleteDrug(deleteDropMatches[el.dataset.idx]));
  });

  menu.style.display = 'block';
}

function pickDeleteDrug(drug) {
  const input = document.getElementById('delete_drug_input');
  const hiddenId = document.getElementById('selected_delete_drug_id');
  const menu = document.getElementById('delete-drug-dropdown');

  if (input) input.value = `${drug.brand_name} (${drug.generic_name || 'N/A'})`;
  if (hiddenId) hiddenId.value = drug.id;
  if (menu) menu.style.display = 'none';
}

const deleteDrugInputEl = document.getElementById('delete_drug_input');
if (deleteDrugInputEl) {
  deleteDrugInputEl.addEventListener('input', () => {
    const hiddenId = document.getElementById('selected_delete_drug_id');
    if (hiddenId) hiddenId.value = '';
    showDeleteDrugList(deleteDrugInputEl.value);
  });

  deleteDrugInputEl.addEventListener('keydown', (e) => {
    const menu = document.getElementById('delete-drug-dropdown');
    const items = menu ? menu.querySelectorAll('.pos-option') : [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) {
        deleteDropIndex = (deleteDropIndex + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === deleteDropIndex));
        items[deleteDropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) {
        deleteDropIndex = (deleteDropIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === deleteDropIndex));
        items[deleteDropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (menu && menu.style.display !== 'none' && deleteDropMatches[deleteDropIndex]) {
        pickDeleteDrug(deleteDropMatches[deleteDropIndex]);
      }
    } else if (e.key === 'Escape') {
      if (menu) menu.style.display = 'none';
    }
  });
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('delete-drug-dropdown');
  if (menu && !menu.contains(e.target) && e.target !== deleteDrugInputEl) {
    menu.style.display = 'none';
  }
});

// Delete Selected Medicine Action
const deleteSelectedDrugBtn = document.getElementById('delete-selected-drug-btn');
if (deleteSelectedDrugBtn) {
  deleteSelectedDrugBtn.addEventListener('click', async () => {
    const hiddenId = document.getElementById('selected_delete_drug_id');
    const input = document.getElementById('delete_drug_input');
    const msg = document.getElementById('delete-drug-status-msg');
    const drugId = parseInt(hiddenId ? hiddenId.value : '', 10);

    if (!drugId || isNaN(drugId)) {
      msg.style.color = '#dc2626';
      msg.innerText = 'Please search and select a medicine from the list.';
      if (input) input.focus();
      return;
    }

    deleteSelectedDrugBtn.disabled = true;
    msg.style.color = '#475569';
    msg.innerText = 'Deleting medicine...';

    try {
      const res = await window.api.deleteMedicineKeepSales(drugId);
      if (res && res.success) {
        msg.style.color = '#16a34a';
        msg.innerText = '✓ Medicine removed from database!';
        if (input) input.value = '';
        if (hiddenId) hiddenId.value = '';
        await loadDeleteDrugDropdown();
        if (typeof displayDrugDropdown === 'function') await displayDrugDropdown();
        await refreshAlertBadges();
      } else {
        msg.style.color = '#dc2626';
        msg.innerText = '✗ Error: ' + (res && res.error ? res.error : 'Failed to delete');
      }
    } catch (err) {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + err.message;
    } finally {
      deleteSelectedDrugBtn.disabled = false;
      setTimeout(() => { msg.innerText = ''; }, 3000);
    }
  });
}

// 2. Delete Selected Sale (By Invoice ID)
const deleteSelectedSaleBtn = document.getElementById('delete-selected-sale-btn');
if (deleteSelectedSaleBtn) {
  deleteSelectedSaleBtn.addEventListener('click', async () => {
    const saleInput = document.getElementById('delete_sale_input');
    const pinInput = document.getElementById('admin-pin-delete-sale');
    const msg = document.getElementById('delete-sale-status-msg');

    if (!saleInput || !pinInput || !msg) return;

    const saleId = parseInt(saleInput.value.trim(), 10);

    if (!saleId || isNaN(saleId)) {
      msg.style.color = '#dc2626';
      msg.innerText = 'Please enter a valid Invoice Number.';
      saleInput.focus();
      return;
    }

    if (pinInput.value.trim() !== '1234') {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Invalid PIN.';
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    deleteSelectedSaleBtn.disabled = true;
    msg.style.color = '#475569';
    msg.innerText = 'Deleting sale record...';

    try {
      const res = await window.api.deleteSingleSale(saleId);
      if (res && res.success) {
        msg.style.color = '#16a34a';
        msg.innerText = `✓ Invoice #${saleId} deleted successfully!`;
      } else {
        msg.style.color = '#dc2626';
        msg.innerText = '✗ ' + (res && res.error ? res.error : 'Invoice not found');
      }
    } catch (err) {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + err.message;
    } finally {
      saleInput.value = '';
      pinInput.value = '';
      deleteSelectedSaleBtn.disabled = false;
      setTimeout(() => { msg.innerText = ''; }, 3000);
    }
  });
}

// 3. Clear All Medicines Only
const deleteAllDrugsBtn = document.getElementById('delete-all-drugs-btn');
if (deleteAllDrugsBtn) {
  deleteAllDrugsBtn.addEventListener('click', async () => {
    const pinInput = document.getElementById('admin-pin-clear-medicines');
    const msg = document.getElementById('delete-all-drugs-msg');

    if (!pinInput || !msg) return;

    if (pinInput.value.trim() !== '1234') {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Invalid PIN.';
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    deleteAllDrugsBtn.disabled = true;
    msg.style.color = '#475569';
    msg.innerText = 'Clearing all medicines...';

    try {
      const res = await window.api.deleteAllMedicinesKeepSales();
      if (res && res.success) {
        msg.style.color = '#16a34a';
        msg.innerText = '✓ All medicines and stocks cleared!';
        await loadDeleteDrugDropdown();
        if (typeof displayDrugDropdown === 'function') await displayDrugDropdown();
        await refreshAlertBadges();
      } else {
        msg.style.color = '#dc2626';
        msg.innerText = '✗ Error: ' + (res && res.error ? res.error : 'Failed');
      }
    } catch (err) {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + err.message;
    } finally {
      pinInput.value = '';
      deleteAllDrugsBtn.disabled = false;
      setTimeout(() => { msg.innerText = ''; }, 3000);
    }
  });
}

// 4. Clear All Sales Only
const clearAllSalesBtn = document.getElementById('clear-all-sales-btn');
if (clearAllSalesBtn) {
  clearAllSalesBtn.addEventListener('click', async () => {
    const pinInput = document.getElementById('admin-pin-clear-sales');
    const msg = document.getElementById('clear-all-sales-msg');

    if (!pinInput || !msg) return;

    if (pinInput.value.trim() !== '1234') {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Invalid PIN.';
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    clearAllSalesBtn.disabled = true;
    msg.style.color = '#475569';
    msg.innerText = 'Clearing sales history...';

    try {
      const res = await window.api.deleteAllSales();
      if (res && res.success) {
        msg.style.color = '#16a34a';
        msg.innerText = '✓ All sales history & charts cleared!';
      } else {
        msg.style.color = '#dc2626';
        msg.innerText = '✗ Error: ' + (res && res.error ? res.error : 'Failed');
      }
    } catch (err) {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + err.message;
    } finally {
      pinInput.value = '';
      clearAllSalesBtn.disabled = false;
      setTimeout(() => { msg.innerText = ''; }, 3000);
    }
  });
}

// 5. Full Factory Reset
const wipeDatabaseBtn = document.getElementById('wipe-database-btn');
if (wipeDatabaseBtn) {
  wipeDatabaseBtn.addEventListener('click', async () => {
    const pinInput = document.getElementById('admin-pin-confirm');
    const msg = document.getElementById('wipe-status-msg');

    if (!pinInput || !msg) return;

    if (pinInput.value.trim() !== '1234') {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Invalid PIN.';
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    wipeDatabaseBtn.disabled = true;
    msg.style.color = '#475569';
    msg.innerText = 'Wiping complete database...';

    try {
      const res = await window.api.clearInventory();
      if (res && res.success) {
        msg.style.color = '#16a34a';
        msg.innerText = '✓ Complete system wiped successfully!';
        await loadDeleteDrugDropdown();
        if (typeof displayDrugDropdown === 'function') await displayDrugDropdown();
        await refreshAlertBadges();
      } else {
        msg.style.color = '#dc2626';
        msg.innerText = '✗ Error: ' + (res && res.error ? res.error : 'Failed');
      }
    } catch (err) {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + err.message;
    } finally {
      pinInput.value = '';
      wipeDatabaseBtn.disabled = false;
      setTimeout(() => { msg.innerText = ''; }, 3000);
    }
  });
}

// ==================== RECEIPT PRINTING MODULE ====================
async function printThermalReceipt(saleId, dateStr, items, grandTotal, paidAmount = 0, balanceAmount = 0, discount = 0, subtotal = null) {
  if (!items || items.length === 0) return;

  const payload = {
    saleId,
    dateStr,
    items,
    grandTotal,
    paidAmount,
    balanceAmount,
    discount: parseFloat(discount) || 0,
    subtotal: subtotal !== null ? subtotal : grandTotal + (parseFloat(discount) || 0),
    pharmacyName: currentSettings.pharmacy_name,
    pharmacyAddress: currentSettings.pharmacy_address,
    pharmacyPhone: currentSettings.pharmacy_phone
  };

  if (window.api && typeof window.api.printReceipt === 'function') {
    const res = await window.api.printReceipt(payload);
    if (!res.success && res.error) {
      console.warn('Print action notice:', res.error);
    }
  }
}

// ==================== CHECKOUT & PRINT ACTION ====================
let isCheckingOut = false;

async function processCheckout({ shouldPrint = true } = {}) {
  const msg = document.getElementById('checkout-status-msg');

  if (isCheckingOut) return;

  if (!currentActiveShift) {
    navigateToTab('till-view', '⚠️ Till is closed. Please open a shift before completing transactions.');
    return;
  }

  if (currentCart.length === 0) {
    if (msg) {
      msg.style.color = '#dc2626';
      msg.innerText = 'Cart is empty. Add items first.';
    }
    return;
  }

  isCheckingOut = true;
  if (checkoutBtn) checkoutBtn.disabled = true;

  try {
    const subtotal = currentCart.reduce((sum, item) => sum + item.total_price, 0);
    const discountInput = document.getElementById('pos-discount-amount');
    const paidInput = document.getElementById('pos-paid-amount');

    const discountPercent = Math.max(0, Math.min(100, parseFloat(discountInput && discountInput.value ? discountInput.value : 0) || 0));
    const discountVal = (subtotal * discountPercent) / 100;
    const grandTotal = Math.max(0, subtotal - discountVal);

    let paidVal = parseFloat(paidInput && paidInput.value ? paidInput.value : 0) || 0;
    if (paidVal === 0) {
      paidVal = grandTotal;
    }

    const balanceVal = paidVal - grandTotal;
    const printedCart = [...currentCart];
    const nowStr = new Date().toLocaleString();

    if (msg) {
      msg.style.color = '#475569';
      msg.innerText = 'Processing sale...';
    }

    const res = await window.api.checkout({ cart: currentCart, total: grandTotal, discount: discountVal });

    if (res.success) {
      if (msg) {
        msg.style.color = '#16a34a';
        msg.innerText = `✓ Sale completed! Invoice #${res.data.saleId}${shouldPrint ? ' (Printing...)' : ' (Saved)'}`;
      }

      currentCart = [];
      if (discountInput) discountInput.value = '';
      if (paidInput) paidInput.value = '';
      renderCart();
      await loadPosStock();
      await refreshAlertBadges();
      await checkActiveShiftStatus();

      const pInput = document.getElementById('pos_drug_input');
      if (pInput) pInput.focus();

      if (shouldPrint) {
        await printThermalReceipt(res.data.saleId, nowStr, printedCart, grandTotal, paidVal, balanceVal, discountVal, subtotal);
      }

      setTimeout(() => {
        if (msg) msg.innerText = '';
      }, 3000);
    } else {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.innerText = '✗ Error: ' + res.error;
      }
    }
  } catch (err) {
    console.error('Checkout error:', err);
  } finally {
    isCheckingOut = false;
    if (checkoutBtn) checkoutBtn.disabled = false;
  }
}

const checkoutBtn = document.getElementById('checkout-btn');
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    processCheckout({ shouldPrint: true });
  });
}

// ==================== SALES SEARCH & INVOICE EXCHANGE MODULE ====================
let editingSaleId = null;
let editingSaleItems = [];
let editDropIndex = 0;
let editDropMatches = [];

window.openEditSaleModal = async (saleId) => {
  editingSaleId = saleId;
  const modal = document.getElementById('edit-sale-modal');
  const title = document.getElementById('edit-sale-modal-title');
  const msg = document.getElementById('edit-sale-status-msg');
  const discountInput = document.getElementById('edit-sale-discount-input');
  if (msg) msg.innerText = '';

  title.innerText = `Edit / Exchange Invoice #${saleId}`;
  modal.style.display = 'flex';

  await loadPosStock();

  const res = await window.api.getSaleDetails(saleId);
  if (res.success) {
    editingSaleItems = res.data.map(i => ({
      batch_id: i.batch_id,
      brand_name: i.brand_name,
      batch_number: i.batch_number,
      buy_price: parseFloat(i.buy_price) || 0,
      sell_price: parseFloat(i.unit_price) || 0,
      quantity: parseInt(i.quantity, 10),
      total_price: parseFloat(i.total_price)
    }));

    if (discountInput) {
      const discountLKR = res.data.length > 0 && res.data[0].sale_discount ? res.data[0].sale_discount : 0;
      const subtotal = editingSaleItems.reduce((sum, item) => sum + item.total_price, 0);
      const percent = subtotal > 0 ? ((discountLKR / subtotal) * 100).toFixed(2) : 0;
      discountInput.value = parseFloat(percent) > 0 ? percent : '';
    }

    renderEditSaleItems();
  }
};

function renderEditSaleItems() {
  const tbody = document.getElementById('edit-sale-items-body');
  const totalDisplay = document.getElementById('edit-sale-total-display');
  const discountInput = document.getElementById('edit-sale-discount-input');
  if (!tbody) return;

  if (editingSaleItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 12px;">No items in invoice. Please add at least one item.</td></tr>`;
    totalDisplay.innerText = 'LKR 0.00';
    return;
  }

  tbody.innerHTML = '';
  let subtotal = 0;

  editingSaleItems.forEach((item, index) => {
    subtotal += item.total_price;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.brand_name}</strong></td>
      <td><code>${item.batch_number || 'N/A'}</code></td>
      <td>${item.sell_price.toFixed(2)}</td>
      <td>
        <input type="number" min="1" value="${item.quantity}" onchange="updateEditItemQty(${index}, this.value)" style="width: 65px; padding: 3px 6px; font-weight: bold;" />
      </td>
      <td><strong>${item.total_price.toFixed(2)}</strong></td>
      <td>
        <button onclick="removeEditItem(${index})" style="background: #fee2e2; color: #b91c1c; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">✕</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const discountPercent = Math.max(0, Math.min(100, parseFloat(discountInput ? discountInput.value : 0) || 0));
  const discountVal = (subtotal * discountPercent) / 100;
  const netTotal = Math.max(0, subtotal - discountVal);
  totalDisplay.innerText = `LKR ${netTotal.toFixed(2)}`;
}

const editSaleDiscountInput = document.getElementById('edit-sale-discount-input');
if (editSaleDiscountInput) {
  editSaleDiscountInput.addEventListener('input', renderEditSaleItems);
}

window.updateEditItemQty = (index, val) => {
  const qty = parseInt(val, 10);
  if (!qty || qty <= 0) return;
  editingSaleItems[index].quantity = qty;
  editingSaleItems[index].total_price = qty * editingSaleItems[index].sell_price;
  renderEditSaleItems();
};

window.removeEditItem = (index) => {
  editingSaleItems.splice(index, 1);
  renderEditSaleItems();
};

function pickEditSaleItem(item) {
  const input = document.getElementById('edit_sale_drug_input');
  const menu = document.getElementById('edit-sale-dropdown');
  const qty = document.getElementById('edit_sale_qty');

  if (input) {
    input.value = `${item.brand_name} | Batch: ${item.batch_number} | LKR ${item.sell_price.toFixed(2)}`;
  }
  if (menu) menu.style.display = 'none';
  if (qty) {
    qty.focus();
    qty.select();
  }
}

const editSaleDrugInput = document.getElementById('edit_sale_drug_input');
if (editSaleDrugInput) {
  editSaleDrugInput.addEventListener('input', () => {
    const menu = document.getElementById('edit-sale-dropdown');
    const term = editSaleDrugInput.value.toLowerCase().trim();
    if (!term) {
      menu.style.display = 'none';
      return;
    }

    editDropMatches = availablePosStock.filter(
      (d) =>
        d.brand_name.toLowerCase().includes(term) ||
        (d.generic_name && d.generic_name.toLowerCase().includes(term)) ||
        d.batch_number.toLowerCase().includes(term)
    );

    if (editDropMatches.length === 0) {
      menu.style.display = 'none';
      return;
    }

    editDropIndex = 0;
    menu.innerHTML = editDropMatches
      .map(
        (d, i) => `
      <div class="pos-option ${i === 0 ? 'selected' : ''}" data-idx="${i}">
        ${d.brand_name} | Batch: <code>${d.batch_number}</code> | Stock: ${d.available_qty} | <strong>LKR ${d.sell_price.toFixed(2)}</strong>
      </div>
    `
      )
      .join('');

    menu.querySelectorAll('.pos-option').forEach((el) => {
      el.addEventListener('click', () => {
        pickEditSaleItem(editDropMatches[el.dataset.idx]);
      });
    });

    menu.style.display = 'block';
  });

  editSaleDrugInput.addEventListener('keydown', (e) => {
    const menu = document.getElementById('edit-sale-dropdown');
    const items = menu ? menu.querySelectorAll('.pos-option') : [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) {
        editDropIndex = (editDropIndex + 1) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === editDropIndex));
        items[editDropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) {
        editDropIndex = (editDropIndex - 1 + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle('selected', i === editDropIndex));
        items[editDropIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (menu && menu.style.display !== 'none' && editDropMatches[editDropIndex]) {
        pickEditSaleItem(editDropMatches[editDropIndex]);
      } else {
        const qty = document.getElementById('edit_sale_qty');
        if (qty) {
          qty.focus();
          qty.select();
        }
      }
    } else if (e.key === 'Escape') {
      if (menu) menu.style.display = 'none';
    }
  });
}

const editSaleQtyInput = document.getElementById('edit_sale_qty');
if (editSaleQtyInput) {
  editSaleQtyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const addBtn = document.getElementById('edit-sale-add-item-btn');
      if (addBtn) addBtn.click();
    }
  });
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('edit-sale-dropdown');
  if (menu && !menu.contains(e.target) && e.target !== editSaleDrugInput) {
    menu.style.display = 'none';
  }
});

const editSaleAddItemBtn = document.getElementById('edit-sale-add-item-btn');
if (editSaleAddItemBtn) {
  editSaleAddItemBtn.addEventListener('click', () => {
    const text = editSaleDrugInput.value.trim();
    const qtyInput = document.getElementById('edit_sale_qty');
    const qty = parseInt(qtyInput.value, 10);

    const selectedStock = availablePosStock.find(i => text.includes(i.batch_number) && text.includes(i.brand_name));
    if (!selectedStock) {
      alert('Please choose a valid medicine from the dropdown list.');
      return;
    }
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    const existingIndex = editingSaleItems.findIndex(i => i.batch_id === selectedStock.batch_id);
    if (existingIndex > -1) {
      editingSaleItems[existingIndex].quantity += qty;
      editingSaleItems[existingIndex].total_price = editingSaleItems[existingIndex].quantity * selectedStock.sell_price;
    } else {
      editingSaleItems.push({
        batch_id: selectedStock.batch_id,
        brand_name: selectedStock.brand_name,
        batch_number: selectedStock.batch_number,
        buy_price: parseFloat(selectedStock.buy_price) || 0,
        sell_price: parseFloat(selectedStock.sell_price) || 0,
        quantity: qty,
        total_price: qty * selectedStock.sell_price
      });
    }

    editSaleDrugInput.value = '';
    qtyInput.value = '1';
    renderEditSaleItems();
  });
}

const closeEditSaleBtn = document.getElementById('close-edit-sale-modal');
if (closeEditSaleBtn) {
  closeEditSaleBtn.addEventListener('click', () => {
    document.getElementById('edit-sale-modal').style.display = 'none';
  });
}
const cancelEditSaleBtn = document.getElementById('cancel-edit-sale-btn');
if (cancelEditSaleBtn) {
  cancelEditSaleBtn.addEventListener('click', () => {
    document.getElementById('edit-sale-modal').style.display = 'none';
  });
}

const saveEditSaleBtn = document.getElementById('save-edit-sale-btn');
if (saveEditSaleBtn) {
  saveEditSaleBtn.addEventListener('click', async () => {
    const msg = document.getElementById('edit-sale-status-msg');

    if (!editingSaleItems || editingSaleItems.length === 0) {
      msg.style.color = '#dc2626';
      msg.innerText = 'Invoice cannot be empty. Add at least one medicine.';
      return;
    }

    const subtotal = editingSaleItems.reduce((sum, i) => sum + i.total_price, 0);
    const discountInput = document.getElementById('edit-sale-discount-input');
    const discountPercent = Math.max(0, Math.min(100, parseFloat(discountInput ? discountInput.value : 0) || 0));
    const discountVal = (subtotal * discountPercent) / 100;
    const grandTotal = Math.max(0, subtotal - discountVal);

    saveEditSaleBtn.disabled = true;
    msg.style.color = '#475569';
    msg.innerText = 'Updating invoice and syncing stock...';

    try {
      const res = await window.api.updateSale({
        saleId: editingSaleId,
        items: editingSaleItems,
        total: grandTotal,
        discount: discountVal
      });

      if (res.success) {
        msg.style.color = '#16a34a';
        msg.innerText = '✓ Invoice updated & stock synced successfully!';

        await loadSalesHistory();
        await loadPosStock();
        await refreshAlertBadges();

        await printThermalReceipt(
          editingSaleId,
          new Date().toLocaleString() + ' (MODIFIED)',
          editingSaleItems,
          grandTotal,
          grandTotal,
          0,
          discountVal,
          subtotal
        );

        setTimeout(() => {
          document.getElementById('edit-sale-modal').style.display = 'none';
        }, 1000);
      } else {
        msg.style.color = '#dc2626';
        msg.innerText = '✗ Error: ' + res.error;
      }
    } catch (err) {
      msg.style.color = '#dc2626';
      msg.innerText = '✗ Error: ' + err.message;
    } finally {
      saveEditSaleBtn.disabled = false;
    }
  });
}

// ==================== GLOBAL FUNCTION KEY TAB SHORTCUTS (F1 - F7) ====================
const functionKeyTabMap = {
  F1: 'add-drug-view',
  F2: 'add-batch-view',
  F3: 'inventory-view',
  F4: 'pos-view',
  F5: 'sales-view',
  F6: 'reports-view',
  F7: 'profits-view'
};

window.addEventListener('keydown', async (e) => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    if (e.key !== 'Escape' && !e.key.startsWith('F')) {
      return;
    }
  }

  if (functionKeyTabMap[e.key]) {
    e.preventDefault();
    const targetViewId = functionKeyTabMap[e.key];

    if (targetViewId === 'pos-view') {
      await checkActiveShiftStatus();
      if (!currentActiveShift) {
        navigateToTab('till-view', '⚠️ Till is currently CLOSED. Please enter starting cash float and open till shift first.');
        return;
      }
    }

    navigateToTab(targetViewId);
  }
});