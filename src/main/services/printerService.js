const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const ReceiptPrinterEncoder = require('@point-of-sale/receipt-printer-encoder');

class PrinterService {
  static async printReceipt(receiptData) {
    try {
      const encoder = new ReceiptPrinterEncoder({
        language: 'esc-pos',
        columns: 48
      });

      const receiptContent = encoder
        .initialize()
        .raw([0x1b, 0x61, 0x01])
        .bold(true)
        .size(2, 2)
        .line('NEW SAHASNA PHARMACY')
        .size(1, 1)
        .bold(false)
        .raw([0x1b, 0x61, 0x01])
        .line('No.514, Walagedara, Balapitiya')
        .line('Tel: 077-6723395')
        .rule({ style: 'single' })
        .raw([0x1b, 0x61, 0x00])
        .line(`Invoice #: #${receiptData.saleId}`)
        .line(`Date     : ${receiptData.dateStr}`)
        .rule({ style: 'single' })
        .bold(true)
        .table(
          [
            { width: 22, align: 'left' },
            { width: 4, align: 'center' },
            { width: 10, align: 'right' },
            { width: 12, align: 'right' }
          ],
          [['Item', 'Qty', 'Price', 'Total']]
        )
        .bold(false)
        .rule({ style: 'single' });

      receiptData.items.forEach((item) => {
        const rawName = item.brand_name || item.brand || item.generic_name || 'Item';
        const name = rawName.length > 21 ? rawName.slice(0, 20) + '.' : rawName;
        const qty = String(item.quantity || 1);
        const unitPrice = Number(item.sell_price !== undefined ? item.sell_price : (item.unit_price || 0)).toFixed(2);
        const total = Number(item.total_price !== undefined ? item.total_price : (item.quantity * unitPrice)).toFixed(2);

        receiptContent
          .newline(1)
          .table(
            [
              { width: 22, align: 'left' },
              { width: 4, align: 'center' },
              { width: 10, align: 'right' },
              { width: 12, align: 'right' }
            ],
            [[name, qty, unitPrice, total]]
          );
      });

      receiptContent
        .rule({ style: 'single' })
        .bold(true)
        .table(
          [
            { width: 24, align: 'left' },
            { width: 24, align: 'right' }
          ],
          [['GRAND TOTAL:', `LKR ${Number(receiptData.grandTotal).toFixed(2)}`]]
        )
        .newline(1)
        .bold(false)
        .table(
          [
            { width: 24, align: 'left' },
            { width: 24, align: 'right' }
          ],
          [
            ['Cash Paid:', `LKR ${Number(receiptData.paidAmount).toFixed(2)}`],
            ['Change / Balance:', `LKR ${Number(receiptData.balanceAmount).toFixed(2)}`]
          ]
        )
        .rule({ style: 'single' })
        .raw([0x1b, 0x61, 0x01])
        .line('Thank you for choosing Sahasna Pharmacy!')
        .line('Get well soon!')
        .newline(6)
        .cut();

      const rawBytes = encoder.encode();
      const tempFilePath = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
      fs.writeFileSync(tempFilePath, Buffer.from(rawBytes));

      const rawPrintCmd = `cmd.exe /c copy /b "${tempFilePath}" "\\\\127.0.0.1\\receipt"`;

      return new Promise((resolve) => {
        exec(rawPrintCmd, (err) => {
          try { fs.unlinkSync(tempFilePath); } catch (e) {}
          if (err) {
            console.error('Raw print error:', err);
            resolve({ success: false, error: err.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    } catch (error) {
      console.error('Receipt Generation Error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = PrinterService;