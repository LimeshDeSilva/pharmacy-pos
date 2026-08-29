class AnalyticsRepository {
  constructor(db) {
    this.db = db;
  }

  getSalesKPIs() {
    const today = this.db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS today_revenue, COUNT(id) AS today_orders
      FROM sales 
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
    `).get();

    const month = this.db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS month_revenue, COUNT(id) AS month_orders
      FROM sales 
      WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
    `).get();

    const total = this.db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) AS all_time_revenue, COUNT(id) AS all_time_orders
      FROM sales
    `).get();

    return { today, month, total };
  }

  getDailySalesAnalytics() {
    return this.db.prepare(`
      SELECT 
        date(created_at, 'localtime') AS period,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM sales
      WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-6 days')
      GROUP BY date(created_at, 'localtime')
      ORDER BY date(created_at, 'localtime') ASC
    `).all();
  }

  getWeeklySalesAnalytics() {
    return this.db.prepare(`
      SELECT 
        strftime('%Y-W%W', created_at, 'localtime') AS period,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM sales
      WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-56 days')
      GROUP BY strftime('%Y-W%W', created_at, 'localtime')
      ORDER BY period ASC
    `).all();
  }

  getMonthlySalesAnalytics() {
    return this.db.prepare(`
      SELECT 
        strftime('%Y-%m', created_at, 'localtime') AS period,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM sales
      WHERE date(created_at, 'localtime') >= date('now', 'localtime', '-180 days')
      GROUP BY strftime('%Y-%m', created_at, 'localtime')
      ORDER BY period ASC
    `).all();
  }

  getStockAlertsSummary() {
    const lowStock = this.db.prepare(`
      SELECT COUNT(*) as count FROM (
        SELECT d.id, d.min_stock_alert, COALESCE(SUM(b.quantity), 0) as total_qty
        FROM drugs d
        LEFT JOIN batches b ON d.id = b.drug_id
        GROUP BY d.id
        HAVING total_qty <= d.min_stock_alert
      )
    `).get();

    const expiringSoon = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM batches 
      WHERE quantity > 0 AND date(expiry_date) <= date('now', '+30 days')
    `).get();

    return {
      lowStockCount: lowStock.count,
      expiringCount: expiringSoon.count
    };
  }

  getProfitKPIs() {
    const getMargin = (whereClause, param) => {
      const query = `
        SELECT 
          COUNT(DISTINCT s.id) AS orders,
          COALESCE(SUM(si.quantity * (si.unit_price - COALESCE(b.buy_price, 0))), 0) AS profit
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN batches b ON si.batch_id = b.id
        ${whereClause}
      `;
      const row = param ? this.db.prepare(query).get(param) : this.db.prepare(query).get();
      return {
        orders: row ? row.orders : 0,
        profit: row ? row.profit : 0
      };
    };

    const today = getMargin(`WHERE date(s.created_at, 'localtime') = date('now', 'localtime')`);
    const month = getMargin(`WHERE strftime('%Y-%m', s.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`);
    const total = getMargin('');

    return { today, month, total };
  }

  getDailyProfitAnalytics() {
    return this.db.prepare(`
      SELECT 
        date(s.created_at, 'localtime') AS period,
        COALESCE(SUM(si.quantity * (si.unit_price - COALESCE(b.buy_price, 0))), 0) AS total_profit
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', '-6 days')
      GROUP BY date(s.created_at, 'localtime')
      ORDER BY date(s.created_at, 'localtime') ASC
    `).all();
  }

  getWeeklyProfitAnalytics() {
    return this.db.prepare(`
      SELECT 
        strftime('%Y-W%W', s.created_at, 'localtime') AS period,
        COALESCE(SUM(si.quantity * (si.unit_price - COALESCE(b.buy_price, 0))), 0) AS total_profit
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', '-56 days')
      GROUP BY strftime('%Y-W%W', s.created_at, 'localtime')
      ORDER BY period ASC
    `).all();
  }

  getMonthlyProfitAnalytics() {
    return this.db.prepare(`
      SELECT 
        strftime('%Y-%m', s.created_at, 'localtime') AS period,
        COALESCE(SUM(si.quantity * (si.unit_price - COALESCE(b.buy_price, 0))), 0) AS total_profit
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN batches b ON si.batch_id = b.id
      WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', '-180 days')
      GROUP BY strftime('%Y-%m', s.created_at, 'localtime')
      ORDER BY period ASC
    `).all();
  }
}

module.exports = AnalyticsRepository;