const fs = require('fs');

class ImportService {
  static async importInventoryCSV(db, drugRepo, batchRepo, filePath) {
    try {
      if (!filePath) return { success: false, canceled: true };

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

      if (lines.length < 2) {
        return { success: false, error: 'File is empty or missing header row.' };
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      
      const getColIdx = (names) => {
        for (const name of names) {
          const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxBrand = getColIdx(['brand_name', 'brand name', 'brand name', 'brand_name ']);
      const idxGeneric = getColIdx(['generic_name', 'generic name']);
      const idxCategory = getColIdx(['category']);
      const idxMinStock = getColIdx(['min_stock_alert', 'min stock alert']);
      const idxBuyPrice = getColIdx(['buy_price', 'buy price']);
      const idxSellPrice = getColIdx(['sell_price', 'sell price']);
      const idxExpiry = getColIdx(['expiry_date', 'expiry date']);
      const idxBatch = getColIdx(['batch_number', 'batch number', 'batch']);
      const idxBarcode = getColIdx(['barcode']);
      const idxQuantity = getColIdx(['quantity', 'qty']);

      if (idxBrand === -1) {
        return { success: false, error: `CSV missing required "brand_name" or "Brand name" column. Found headers: ${headers.join(', ')}` };
      }

      let importedCount = 0;

      const importTx = db.transaction((rows) => {
        for (const rowStr of rows) {
          const cols = [];
          let inQuote = false;
          let currentVal = '';
          for (let i = 0; i < rowStr.length; i++) {
            const char = rowStr[i];
            if (char === '"') {
              inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
              cols.push(currentVal.trim().replace(/^"|"$/g, ''));
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          cols.push(currentVal.trim().replace(/^"|"$/g, ''));

          const brandName = cols[idxBrand];
          if (!brandName || brandName.toLowerCase() === 'nan') continue;

          const genericName = idxGeneric !== -1 && cols[idxGeneric] && cols[idxGeneric].toLowerCase() !== 'nan' ? cols[idxGeneric] : '';
          const category = idxCategory !== -1 && cols[idxCategory] && cols[idxCategory].toLowerCase() !== 'nan' ? cols[idxCategory] : 'General';
          const minStock = idxMinStock !== -1 && !isNaN(cols[idxMinStock]) ? parseInt(cols[idxMinStock], 10) || 10 : 10;
          const barcode = idxBarcode !== -1 && cols[idxBarcode] && cols[idxBarcode].toLowerCase() !== 'nan' ? String(cols[idxBarcode]) : null;

          let drug = db.prepare('SELECT id FROM drugs WHERE brand_name = ?').get(brandName);
          let drugId;

          if (drug) {
            drugId = drug.id;
            if (barcode) {
              db.prepare('UPDATE drugs SET barcode = COALESCE(?, barcode) WHERE id = ?').run(barcode, drugId);
            }
          } else {
            const res = drugRepo.addDrug(brandName, genericName, category, minStock, barcode);
            drugId = res.lastInsertRowid;
          }

          const batchNo = idxBatch !== -1 && cols[idxBatch] && cols[idxBatch].toLowerCase() !== 'nan' ? cols[idxBatch] : '';
          const expiry = idxExpiry !== -1 && cols[idxExpiry] && cols[idxExpiry].toLowerCase() !== 'nan' ? cols[idxExpiry].slice(0, 10) : '';
          const buyPrice = idxBuyPrice !== -1 && !isNaN(cols[idxBuyPrice]) ? parseFloat(cols[idxBuyPrice]) || 0 : 0;
          const sellPrice = idxSellPrice !== -1 && !isNaN(cols[idxSellPrice]) ? parseFloat(cols[idxSellPrice]) || 0 : 0;
          const qty = idxQuantity !== -1 && !isNaN(cols[idxQuantity]) ? parseInt(cols[idxQuantity], 10) || 0 : 0;

          if (batchNo && expiry && qty > 0) {
            try {
              batchRepo.addBatch(drugId, batchNo, expiry, buyPrice, sellPrice, qty);
            } catch (err) {}
          }

          importedCount++;
        }
      });

      importTx(lines.slice(1));
      return { success: true, count: importedCount };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

module.exports = ImportService;