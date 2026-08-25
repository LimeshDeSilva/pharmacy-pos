// ==================== 1. SIDEBAR TAB NAVIGATION ====================
const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');
const pageTitle = document.getElementById('page-title');

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    // A. Highlight selected sidebar button
    navItems.forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');

    // B. Show matching view panel
    const targetViewId = item.getAttribute('data-view');
    viewPanels.forEach((panel) => panel.classList.remove('active'));
    
    const activePanel = document.getElementById(targetViewId);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // C. Update top header title
    if (pageTitle) {
      pageTitle.innerText = item.innerText.replace(/[^\w\s()]/gi, '').trim();
    }
  });
});

// ==================== 2. ADD MEDICINE FORM HANDLER ====================
const drugForm = document.getElementById('drug-form');
const drugStatusMsg = document.getElementById('drug-status-msg');

if (drugForm) {
  drugForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect data entered by user
    const drugData = {
      brand_name: document.getElementById('brand_name').value.trim(),
      generic_name: document.getElementById('generic_name').value.trim(),
      category: document.getElementById('category').value.trim(),
      min_stock_alert: parseInt(document.getElementById('min_stock_alert').value, 10) || 10
    };

    // Show temporary status
    drugStatusMsg.style.color = '#475569';
    drugStatusMsg.innerText = 'Saving medicine...';

    // Send to bridge
    const response = await window.api.addDrug(drugData);

    // React to result
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