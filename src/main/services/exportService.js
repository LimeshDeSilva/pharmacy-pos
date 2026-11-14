const fs = require('fs');
const { dialog } = require('electron');

class ExportService {
  static formatExpiryDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      const day = ymd[3].padStart(2, '0');
      const month = ymd[2].padStart(2, '0');
      const year = ymd[1];
      return `${day}/${month}/${year}`;
    }
    return str;
  }

  static escapeCsv(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  static async exportInventoryCSV(win, inventory) {
    try {
      if (Array.isArray(win) && inventory === undefined) {
        inventory = win;
        win = null;
      }

      if (!inventory || inventory.length === 0) {
        return { success: false, error: 'No inventory records found to export.' };
      }

      const options = {
        title: 'Export Inventory to CSV',
        defaultPath: `inventory_export_${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }]
      };

      const { filePath } = (win && typeof win.isDestroyed === 'function' && !win.isDestroyed())
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options);

      if (!filePath) return { success: false, canceled: true };

      const headers = 'Brand Name,Generic Name,Category,Min Stock Alert,Batch Number,Expiry Date,Buy Price,Sell Price,Quantity,Barcode\r\n';
      const rows = inventory.map(item => {
        const brand = ExportService.escapeCsv(item.brand_name || '');
        const generic = ExportService.escapeCsv(item.generic_name || '');
        const category = ExportService.escapeCsv(item.category || '');
        const minStock = item.min_stock_alert !== null && item.min_stock_alert !== undefined ? Number(item.min_stock_alert) : 10;
        const batchNo = ExportService.escapeCsv(item.batch_number || '');
        const expiry = ExportService.formatExpiryDate(item.expiry_date);
        const buyPrice = item.buy_price !== null && item.buy_price !== undefined ? Number(item.buy_price) : 0;
        const sellPrice = item.sell_price !== null && item.sell_price !== undefined ? Number(item.sell_price) : 0;
        const qty = item.batch_quantity !== null && item.batch_quantity !== undefined ? Number(item.batch_quantity) : (item.quantity !== null && item.quantity !== undefined ? Number(item.quantity) : 0);
        const barcode = ExportService.escapeCsv(item.barcode || '');

        return `${brand},${generic},${category},${minStock},${batchNo},${expiry},${buyPrice},${sellPrice},${qty},${barcode}`;
      }).join('\r\n');

      const bom = '\uFEFF';
      fs.writeFileSync(filePath, bom + headers + rows, 'utf-8');
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = ExportService;
