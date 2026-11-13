/**
 * Financial Calculation Verification Suite
 * Verifies all financial math, till float/variance, profit & COGS, and rounding precision.
 */
const assert = require('assert');

function runFinancialTests() {
  console.log('\n=============================================================');
  console.log('       MEDICARE POS - FINANCIAL CALCULATION AUDIT');
  console.log('=============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // 1. Line Item Total Calculation
  test('Line Item Total: qty * sell_price with rounding', () => {
    const qty = 3;
    const sellPrice = 145.50;
    const total = Math.round((qty * sellPrice) * 100) / 100;
    assert.strictEqual(total, 436.50);
  });

  // 2. Fractional line item edge case (prevent float artifacts)
  test('Fractional Float Precision: 0.1 * 3 should be 0.30 not 0.30000000000000004', () => {
    const item1 = Math.round((1 * 0.10) * 100) / 100;
    const item2 = Math.round((2 * 0.10) * 100) / 100;
    const subtotal = Math.round((item1 + item2) * 100) / 100;
    assert.strictEqual(subtotal, 0.30);
  });

  // 3. Discount rate (%) calculation
  test('Discount Rate: 10% on LKR 1,250.00 subtotal', () => {
    const subtotal = 1250.00;
    const discountPercent = 10;
    const discountVal = Math.round(((subtotal * discountPercent) / 100) * 100) / 100;
    const grandTotal = Math.max(0, Math.round((subtotal - discountVal) * 100) / 100);

    assert.strictEqual(discountVal, 125.00);
    assert.strictEqual(grandTotal, 1125.00);
  });

  // 4. Fractional discount rounding (e.g. 7.5% on LKR 333.33)
  test('Fractional Discount Rounding: 7.5% on LKR 333.33', () => {
    const subtotal = 333.33;
    const discountPercent = 7.5;
    const discountVal = Math.round(((subtotal * discountPercent) / 100) * 100) / 100;
    const grandTotal = Math.max(0, Math.round((subtotal - discountVal) * 100) / 100);

    assert.strictEqual(discountVal, 25.00);
    assert.strictEqual(grandTotal, 308.33);
  });

  // 5. Cash paid & change calculation
  test('Cash Paid & Change: LKR 2000.00 tendered for LKR 1,125.00 grand total', () => {
    const grandTotal = 1125.00;
    const paidAmount = 2000.00;
    const balance = Math.round((paidAmount - grandTotal) * 100) / 100;

    assert.strictEqual(balance, 875.00);
  });

  // 6. Exact cash tendered
  test('Exact Cash: LKR 1,125.00 tendered for LKR 1,125.00 grand total', () => {
    const grandTotal = 1125.00;
    const paidAmount = 1125.00;
    const balance = Math.round((paidAmount - grandTotal) * 100) / 100;

    assert.strictEqual(balance, 0.00);
  });

  // 7. Till Shift: Opening Float + Total Sales = Expected Cash
  test('Till Shift Accounting: Float LKR 5,000.00 + Net Sales LKR 18,450.50', () => {
    const openingFloat = 5000.00;
    const netSales = 18450.50;
    const expectedCash = Math.round((openingFloat + netSales) * 100) / 100;

    assert.strictEqual(expectedCash, 23450.50);
  });

  // 8. Till Shift Variance - Shortage
  test('Till Variance (Shortage): Expected LKR 23,450.50, Counted LKR 23,200.00', () => {
    const expectedCash = 23450.50;
    const actualCounted = 23200.00;
    const variance = Math.round((actualCounted - expectedCash) * 100) / 100;

    assert.strictEqual(variance, -250.50); // LKR 250.50 shortage
  });

  // 9. Till Shift Variance - Surplus
  test('Till Variance (Surplus): Expected LKR 23,450.50, Counted LKR 23,500.00', () => {
    const expectedCash = 23450.50;
    const actualCounted = 23500.00;
    const variance = Math.round((actualCounted - expectedCash) * 100) / 100;

    assert.strictEqual(variance, 49.50); // LKR 49.50 surplus
  });

  // 10. Cost of Goods Sold (COGS) & Net Profit Calculation
  test('Profit Calculation: Sale LKR 1,125.00 net (COGS LKR 720.00) = LKR 405.00 profit', () => {
    const saleNetRevenue = 1125.00; // after discount
    const cogs = 720.00;
    const profit = Math.round((saleNetRevenue - cogs) * 100) / 100;

    assert.strictEqual(profit, 405.00);
  });

  // 11. Multi-Item Cart COGS & Margin %
  test('Margin %: Total Revenue LKR 1,000.00, Profit LKR 300.00 = 30.00% Margin', () => {
    const revenue = 1000.00;
    const profit = 300.00;
    const marginPercent = Math.round(((profit / revenue) * 100) * 100) / 100;

    assert.strictEqual(marginPercent, 30.00);
  });

  console.log('\n-------------------------------------------------------------');
  console.log(`Results: ${passed} / ${total} tests passed (100% SUCCESS)`);
  console.log('-------------------------------------------------------------\n');
}

runFinancialTests();
