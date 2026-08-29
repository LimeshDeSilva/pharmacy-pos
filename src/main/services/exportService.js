const fs = require('fs');
const { dialog } = require('electron');

class ExportService {
  static async exportInventoryCSV(inventory) {
    try {
      if (!inventory || inventory.length === 0) {
        return { success: false, error: 'No inventory records found to export.' };
      }

      const { filePath } = await dialog.showSaveDialog({
        title: 'Export Inventory to CSV',
        defaultPath: `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      });

      if (!filePath) return { success: false, canceled: true };

      const headers = 'Brand Name,Generic Name,Category,Batch Number,Expiry Date,Sell Price,Batch Stock,Total Stock\n';
      const rows = inventory.map(item =>
        `"${item.brand_name || ''}","${item.generic_name || ''}","${item.category || ''}","${item.batch_number || ''}","${item.expiry_date || ''}",${item.sell_price || 0},${item.batch_quantity !== null ? item.batch_quantity : 0},${item.total_stock || 0}`
      ).join('\n');

      fs.writeFileSync(filePath, headers + rows, 'utf-8');
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = ExportService;