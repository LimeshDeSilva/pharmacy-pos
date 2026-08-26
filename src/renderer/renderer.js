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

    if (pageTitle) {
      pageTitle.innerText = item.innerText.replace(/[^\w\s()]/gi, '').trim();
    }

    if (targetViewId === 'add-batch-view') {
      await displayDrugDropdown();
    } else if (targetViewId === 'inventory-view') {
      await loadInventory();
    } else if (targetViewId === 'pos-view') {
      await loadPosStock();
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