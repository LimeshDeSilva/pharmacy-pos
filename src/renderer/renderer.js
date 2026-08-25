// ====================  SIDEBAR TAB NAVIGATION ====================
const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');
const pageTitle = document.getElementById('page-title');

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    
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