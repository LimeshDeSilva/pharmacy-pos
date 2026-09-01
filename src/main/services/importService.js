const fs = require('fs');

class ImportService {
  /**
   * Helper to parse CSV lines taking into account quoted strings and commas inside quotes
   */
  static parseCSVLine(line) {
    const result = [];
    let curVal = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          curVal += '"';
          i++; // Skip the escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(curVal.trim());
        curVal = '';
      } else {
        curVal += char;
      }
    }
    result.push(curVal.trim());
    return result.map(v => v.replace(/^"|"$/g, '').trim());
  }

  static async importInventoryCSV(db, drugRepo, batchRepo, filePath) {
    try {
      if (!filePath) return { success: false, canceled: true };

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');

      if (lines.length < 2) {
        return { success: false, error: 'File is empty or missing header row.' };
      }

      const headers = ImportService.parseCSVLine(lines[0]);

      const getColIdx = (names) => {
        for (const name of names) {
          const idx = headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxBrand = getColIdx(['brand_name', 'brand name', 'brand']);
      const idxGeneric = getColIdx(['generic_name', 'generic name', 'generic']);
      const idxCategory = getColIdx(['category']);
      const idxMinStock = getColIdx(['min_stock_alert', 'min stock alert', 'min stock']);
      const idxBuyPrice = getColIdx(['buy_price', 'buy price', 'cost price']);
      const idxSellPrice = getColIdx(['sell_price', 'sell price', 'retail price']);
      const idxExpiry = getColIdx(['expiry_date', 'expiry date', 'exp date', 'expiry']);
      const idxBatch = getColIdx(['batch_number', 'batch number', 'batch no', 'batch']);
      const idxBarcode = getColIdx(['barcode', 'gtin', 'upc']);
      const idxQuantity = getColIdx(['quantity', 'qty', 'stock']);

      if (idxBrand === -1) {
        return { success: false, error: `CSV missing required "Brand name" column. Found headers: ${headers.join(', ')}` };
      }

      let importedCount = 0;

      const importTx = db.transaction((dataLines) => {
        for (const line of dataLines) {
          const cols = ImportService.parseCSVLine(line);
          if (!cols || cols.length === 0) continue;

          const brandName = cols[idxBrand];
          if (!brandName || brandName.toLowerCase() === 'nan') continue;

          const genericName = idxGeneric !== -1 && cols[idxGeneric] && cols[idxGeneric].toLowerCase() !== 'nan' ? cols[idxGeneric] : '';
          const category = idxCategory !== -1 && cols[idxCategory] && cols[idxCategory].toLowerCase() !== 'nan' ? cols[idxCategory] : 'General';
          const minStock = idxMinStock !== -1 && !isNaN(cols[idxMinStock]) ? parseInt(cols[idxMinStock], 10) || 10 : 10;
          const barcode = idxBarcode !== -1 && cols[idxBarcode] && cols[idxBarcode].toLowerCase() !== 'nan' && cols[idxBarcode] !== '' ? String(cols[idxBarcode]) : null;

          let drug = db.prepare('SELECT id FROM drugs WHERE brand_name = ?').get(brandName);
          let drugId;

          if (drug) {
            drugId = drug.id;
            if (barcode) {
              try {
                db.prepare('UPDATE drugs SET barcode = COALESCE(?, barcode) WHERE id = ?').run(barcode, drugId);
              } catch (e) {}
            }
          } else {
            const res = drugRepo.addDrug(brandName, genericName, category, minStock, barcode);
            drugId = res.lastInsertRowid;
          }

          const batchNo = idxBatch !== -1 && cols[idxBatch] && cols[idxBatch].toLowerCase() !== 'nan' ? cols[idxBatch] : '';
          const rawExpiry = idxExpiry !== -1 && cols[idxExpiry] && cols[idxExpiry].toLowerCase() !== 'nan' ? cols[idxExpiry] : '';
          const expiry = rawExpiry ? rawExpiry.slice(0, 10) : '';
          const buyPrice = idxBuyPrice !== -1 && !isNaN(cols[idxBuyPrice]) ? parseFloat(cols[idxBuyPrice]) || 0 : 0;
          const sellPrice = idxSellPrice !== -1 && !isNaN(cols[idxSellPrice]) ? parseFloat(cols[idxSellPrice]) || 0 : 0;
          const qty = idxQuantity !== -1 && !isNaN(cols[idxQuantity]) ? parseInt(cols[idxQuantity], 10) || 0 : 0;

          if (batchNo && expiry && qty > 0) {
            try {
              batchRepo.addBatch(drugId, batchNo, expiry, buyPrice, sellPrice, qty);
            } catch (err) {
              // Update existing batch quantity if duplicate batch
              db.prepare('UPDATE batches SET quantity = quantity + ?, buy_price = ?, sell_price = ?, expiry_date = ? WHERE drug_id = ? AND batch_number = ?')
                .run(qty, buyPrice, sellPrice, expiry, drugId, batchNo);
            }
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