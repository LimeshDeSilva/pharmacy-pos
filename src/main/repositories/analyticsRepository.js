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
        SELECT d.id, d.min_stock_alert, SUM(b.quantity) as total_qty
        FROM drugs d
        JOIN batches b ON d.id = b.drug_id
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
          COUNT(id) AS orders,
          COALESCE(SUM(total_amount - total_cost), 0) AS profit
        FROM (
          SELECT 
            s.id,
            s.total_amount,
            COALESCE(SUM(si.quantity * COALESCE(si.buy_price, b.buy_price, 0)), 0) AS total_cost
          FROM sales s
          LEFT JOIN sale_items si ON s.id = si.sale_id
          LEFT JOIN batches b ON si.batch_id = b.id
          ${whereClause}
          GROUP BY s.id
        )
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
        sale_day AS period,
        COALESCE(SUM(total_amount - total_cost), 0) AS total_profit
      FROM (
        SELECT 
          date(s.created_at, 'localtime') AS sale_day,
          s.total_amount,
          COALESCE(SUM(si.quantity * COALESCE(si.buy_price, b.buy_price, 0)), 0) AS total_cost
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN batches b ON si.batch_id = b.id
        WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', '-6 days')
        GROUP BY s.id
      )
      GROUP BY sale_day
      ORDER BY sale_day ASC
    `).all();
  }

  getWeeklyProfitAnalytics() {
    return this.db.prepare(`
      SELECT 
        sale_week AS period,
        COALESCE(SUM(total_amount - total_cost), 0) AS total_profit
      FROM (
        SELECT 
          strftime('%Y-W%W', s.created_at, 'localtime') AS sale_week,
          s.total_amount,
          COALESCE(SUM(si.quantity * COALESCE(si.buy_price, b.buy_price, 0)), 0) AS total_cost
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN batches b ON si.batch_id = b.id
        WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', '-56 days')
        GROUP BY s.id
      )
      GROUP BY sale_week
      ORDER BY sale_week ASC
    `).all();
  }

  getMonthlyProfitAnalytics() {
    return this.db.prepare(`
      SELECT 
        sale_month AS period,
        COALESCE(SUM(total_amount - total_cost), 0) AS total_profit
      FROM (
        SELECT 
          strftime('%Y-%m', s.created_at, 'localtime') AS sale_month,
          s.total_amount,
          COALESCE(SUM(si.quantity * COALESCE(si.buy_price, b.buy_price, 0)), 0) AS total_cost
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN batches b ON si.batch_id = b.id
        WHERE date(s.created_at, 'localtime') >= date('now', 'localtime', '-180 days')
        GROUP BY s.id
      )
      GROUP BY sale_month
      ORDER BY sale_month ASC
    `).all();
  }
}

module.exports = AnalyticsRepository;


