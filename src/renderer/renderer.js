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