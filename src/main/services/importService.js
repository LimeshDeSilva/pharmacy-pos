const fs = require('fs');

class ImportService {
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
          i++;
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

  static normalizeDate(dateStr) {
    if (!dateStr) return '';
    const str = String(dateStr).trim();
    // Match DD/MM/YYYY or DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
    // Match YYYY-MM-DD or YYYY/MM/DD
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return str.slice(0, 10);
  }

  static async importInventoryCSV(db, drugRepo, batchRepo, filePath) {
    try {
      if (!filePath) return { success: false, canceled: true };

      const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
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
      const idxQuantity = getColIdx(['quantity', 'qty', 'stock']);
      const idxBarcode = getColIdx(['barcode', 'bar code', 'barcode_number', 'ean', 'gtin']);

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
          const barcodeVal = idxBarcode !== -1 && cols[idxBarcode] && cols[idxBarcode].toLowerCase() !== 'nan' ? cols[idxBarcode].trim() : '';

          let drug = db.prepare('SELECT id, barcode FROM drugs WHERE brand_name = ?').get(brandName);
          let drugId;

          if (drug) {
            drugId = drug.id;
            if (barcodeVal && !drug.barcode) {
              try { db.prepare('UPDATE drugs SET barcode = ? WHERE id = ?').run(barcodeVal, drugId); } catch (e) { }
            }
          } else {
            const res = drugRepo.addDrug(brandName, genericName, category, minStock);
            drugId = res.lastInsertRowid;
            if (barcodeVal) {
              try { db.prepare('UPDATE drugs SET barcode = ? WHERE id = ?').run(barcodeVal, drugId); } catch (e) { }
            }
          }

          const batchNo = idxBatch !== -1 && cols[idxBatch] && cols[idxBatch].toLowerCase() !== 'nan' ? cols[idxBatch] : '';
          const rawExpiry = idxExpiry !== -1 && cols[idxExpiry] && cols[idxExpiry].toLowerCase() !== 'nan' ? cols[idxExpiry] : '';
          const expiry = ImportService.normalizeDate(rawExpiry);
          const buyPrice = idxBuyPrice !== -1 && !isNaN(cols[idxBuyPrice]) ? parseFloat(cols[idxBuyPrice]) || 0 : 0;
          const sellPrice = idxSellPrice !== -1 && !isNaN(cols[idxSellPrice]) ? parseFloat(cols[idxSellPrice]) || 0 : 0;
          const qty = idxQuantity !== -1 && !isNaN(cols[idxQuantity]) ? parseInt(cols[idxQuantity], 10) || 0 : 0;

          if (batchNo && expiry && qty > 0) {
            try {
              const resBatch = batchRepo.addBatch(drugId, batchNo, expiry, buyPrice, sellPrice, qty);
              if (barcodeVal && resBatch && resBatch.lastInsertRowid) {
                try { db.prepare('UPDATE batches SET barcode = ? WHERE id = ?').run(barcodeVal, resBatch.lastInsertRowid); } catch (e) { }
              }
            } catch (err) {
              db.prepare('UPDATE batches SET quantity = quantity + ?, buy_price = ?, sell_price = ?, expiry_date = ?, barcode = COALESCE(?, barcode) WHERE drug_id = ? AND batch_number = ?')
                .run(qty, buyPrice, sellPrice, expiry, barcodeVal || null, drugId, batchNo);
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