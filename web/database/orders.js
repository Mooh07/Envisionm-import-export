import sqlite3 from "sqlite3";
import path from "path";

/**
 * @typedef {Object} OrderInput
 * @property {string} order_number - Order number.
 * @property {string} store_link - currently constant email.
 * @property {string} order_number - Order number.
 * @property {string} store_id - store URL.
 * @property {string} order_graphql_admin_id - The order's Shopify graphql admin id.
 * @property {string} customer_graphql_admin_id - The customer's Shopify graphql admin id.
 * @property {'FULFILLED' | 'UNFULFILLED'} fulfillment_status - The fulfillment status of the order. Can be either 'FULFILLED' or 'UNFULFILLED'
 * @property {date} created_at - Order creation date that comes from shopify webhook, ISO8601 format
 *
 *  */
/**
 * @typedef {Object} CustomerInput
 * @property {string} customer_graphql_admin_id - The customer's Shopify graphql admin id.
 * @property {string} customer_email - The customer's email.
 * @property {string} full_name - The customer's full name.
 */

const DEFAULT_DB_FILE = path.join(process.cwd(), "database", "database.sqlite");
export const ordersDB = {
  ordersTableName: "order",
  customersTableName: "customer",
  db: null,
  ready: null,
  /**
   *
   * @param {OrderInput} orderInput
   */
  createOrder: async function (orderInput) {
    let query = `INSERT INTO '${this.ordersTableName}' 
    (customer_graphql_admin_id, fulfillment_status, order_graphql_admin_id, order_number, store_id, store_link,created_at)
    VALUES (?,?,?,?,?,?,?)`;

    try {
      let data = await this.__query(query, [
        orderInput.customer_graphql_admin_id,
        orderInput.fulfillment_status,
        orderInput.order_graphql_admin_id,
        orderInput.order_number,
        orderInput.store_id,
        orderInput.store_link,
        orderInput.created_at,
      ]);
    } catch (error) {
      console.log(error);
    }
  },
  /**
   *
   * @param {CustomerInput} customerInput
   */
  createCustomer: async function (customerInput) {
    let query = `INSERT INTO ${this.customersTableName} (customer_email, customer_graphql_admin_id, full_name) VALUES (?,?,?)`;
    try {
      let data = await this.__query(query, [
        customerInput.customer_email,
        customerInput.customer_graphql_admin_id,
        customerInput.full_name,
      ]);
    } catch (error) {
      console.log(error);
    }
  },
  update: async function ({}) {},
  /**
   *
   * @param {integer} currentPage - current page in database
   * @param {integer} maxPerPage - per page
   * @returns
   */
  listCustomersAndTheirOrders: async function (
    currentPage = 1,
    maxPerPage = 1
  ) {
    let query = `SELECT 
        c.customer_email,
        c.customer_graphql_admin_id,
        c.full_name, 
        o.order_number, 
        o.store_id, 
        o.store_link, 
        o.order_graphql_admin_id, 
        o.created_at, 
        o.fulfillment_status,
        o.customer_graphql_admin_id 
        FROM  
        ${this.customersTableName} AS c INNER JOIN 
        '${this.ordersTableName}' AS o 
        ON 
        c.customer_graphql_admin_id = o.customer_graphql_admin_id
        ORDER BY o.created_at DESC
        LIMIT ${maxPerPage + 1} OFFSET ${maxPerPage * currentPage}`;
    try {
      let result = await this.__query(query);
      const hasMoreItems = result.length > maxPerPage;
      const items = hasMoreItems ? result.slice(0, maxPerPage) : result;
      return { data: items, hasMoreItems };
    } catch (error) {
      console.log(error);
    }
    return { data: [], hasMoreItems: false };
  },
  /**
   * Dynamically filter orders and customers based on user input.
   *
   * @param {Object} filters
   * @param {string} [filters.startDate] - Start of the date range (ISO8601).
   * @param {string} [filters.endDate] - End of the date range (ISO8601).
   * @param {string} [filters.name] - Substring to search in full_name (case-insensitive).
   * @param {'FULFILLED' | 'UNFULFILLED'} [filters.fulfillmentStatus] - Filter by fulfillment status.
   * @param {number} [filters.currentPage] - Pagination: current page number.
   * @param {number} [filters.maxPerPage] - Pagination: maximum items per page.
   * @param {Array<string>} [filters.orderNumbers] - List of order numbers to match.
   * @returns {Promise<{ data: Array, hasMoreItems: boolean }>}
   */
  listFilteredCustomersAndOrders: async function (filters = {}) {
    const {
      startDate,
      endDate,
      name,
      fulfillmentStatus,
      currentPage = 1,
      maxPerPage = 50,
      orderNumbers,
    } = filters;

    let whereClauses = [];
    let params = [];

    // Date range filter
    if (startDate) {
      whereClauses.push(`o.created_at >= ?`);
      params.push(startDate);
    }
    if (endDate) {
      whereClauses.push(`o.created_at <= ?`);
      params.push(endDate);
    }

    // Name filter (case-insensitive)
    if (name) {
      whereClauses.push(`LOWER(c.full_name) LIKE ?`);
      params.push(`%${name.toLowerCase()}%`);
    }

    // Fulfillment status filter
    if (fulfillmentStatus) {
      whereClauses.push(`o.fulfillment_status = ?`);
      params.push(fulfillmentStatus);
    }

    // Order numbers filter
    if (orderNumbers && orderNumbers.length > 0) {
      const placeholders = orderNumbers.map(() => "?").join(", ");
      whereClauses.push(`o.order_number IN (${placeholders})`);
      params.push(...orderNumbers);
    }

    // Combine all where clauses
    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Pagination
    const offset = maxPerPage * (currentPage - 1);
    const pageSql = currentPage
      ? `LIMIT ${maxPerPage + 1} OFFSET ${offset}`
      : "";
    const query = `
      SELECT 
        c.customer_email,
        c.customer_graphql_admin_id,
        c.full_name, 
        o.order_number, 
        o.store_id, 
        o.store_link, 
        o.order_graphql_admin_id, 
        o.created_at, 
        o.fulfillment_status,
        o.customer_graphql_admin_id 
      FROM  
        ${this.customersTableName} AS c 
      INNER JOIN 
        '${this.ordersTableName}' AS o 
      ON 
        c.customer_graphql_admin_id = o.customer_graphql_admin_id
      ${whereSql}
      ORDER BY o.created_at DESC
      ${pageSql}
    `;

    try {
      const result = await this.__query(query, params);
      const hasMoreItems = result.length > maxPerPage;
      const items = hasMoreItems ? result.slice(0, maxPerPage) : result;
      return { data: items, hasMoreItems };
    } catch (error) {
      console.log(error);
      return { data: [], hasMoreItems: false };
    }
  },
  /**
   * Updates the fulfillment status of multiple orders to "FULFILLED".
   *
   * @param {Array<string>} orderNumbers - List of order numbers to update.
   * @returns {Promise<{ success: boolean, message: string, updatedCount: number }>} - Success status, message, and the number of orders updated.
   */
  setOrdersToFulfilled: async function (orderNumbers) {
    if (!Array.isArray(orderNumbers) || orderNumbers.length === 0) {
      return {
        success: false,
        message: "Order numbers are required.",
        updatedCount: 0,
      };
    }
    const placeholders = orderNumbers.map(() => "?").join(", ");
    const query = `
    UPDATE '${this.ordersTableName}'
    SET fulfillment_status = ?
    WHERE order_number IN (${placeholders});
  `;
    const params = ["FULFILLED", ...orderNumbers];
    try {
      const result = await this.__query(query, params);

      if (result.affectedRows > 0) {
        return {
          success: true,
          message: `${result.affectedRows} orders marked as fulfilled successfully.`,
          updatedCount: result.affectedRows,
        };
      } else {
        return {
          success: false,
          message: "No orders found to update.",
          updatedCount: 0,
        };
      }
    } catch (error) {
      console.log("Error updating order statuses:", error);
      return {
        success: false,
        message: "An error occurred while updating the orders.",
        updatedCount: 0,
      };
    }
  },
  read: async function () {},

  /* Private */

  /*
    Used to check whether to create the database.
    Also used to make sure the database and table are set up before the server starts.
  */

  __hasCustomersTable: async function () {
    const query = `
        SELECT name FROM sqlite_schema
        WHERE
          type = 'table' AND
          name = ?;
      `;
    const rows = await this.__query(query, [this.customersTableName]);
    return rows.length === 1;
  },
  /**
   * Initializes the database, optionally resetting it.
   *
   * @param {Boolean} reset - Whether to reset the database or not
   */
  init: async function (reset) {
    this.db = this.db ?? new sqlite3.Database(DEFAULT_DB_FILE);
    this.db.get("PRAGMA foreign_keys = ON");
    const hasCustomersTable = await this.__hasCustomersTable();
    const ordersTableDrop = `DROP TABLE '${this.ordersTableName}'`;
    const customersTableDrop = `DROP TABLE '${this.customersTableName}'`;
    const createCustomersTable = `
        CREATE TABLE ${this.customersTableName} (
          customer_email VARCHAR(255) NOT NULL,
          customer_graphql_admin_id VARCHAR(255) PRIMARY KEY NOT NULL,
          full_name VARCHAR(255) NOT NULL
          )
      `;
    const createOrdersTable = `
        CREATE TABLE '${this.ordersTableName}' (
          order_number VARCHAR(255) PRIMARY KEY NOT NULL,
          store_id VARCHAR(255) NOT NULL,
          store_link VARCHAR(255) NOT NULL,
          order_graphql_admin_id VARCHAR(255) NOT NULL,
          created_at TEXT NOT NULL,
          customer_graphql_admin_id VARCHAR(255) NOT NULL,
          fulfillment_status TEXT NOT NULL DEFAULT 'UNFULFILLED' CHECK (fulfillment_status IN ('FULFILLED', 'UNFULFILLED')),
          FOREIGN KEY (customer_graphql_admin_id) REFERENCES ${this.customersTableName}(customer_graphql_admin_id) ON DELETE CASCADE
        )
      `;
    if (reset && hasCustomersTable) {
      await this.__query(customersTableDrop);
      await this.__query(ordersTableDrop);
    }
    if (reset) {
      await this.__query(createCustomersTable);
      await this.__query(createOrdersTable);
    }
    this.ready = Promise.resolve();
  },

  /* Perform a query on the database. Used by the various CRUD methods. */
  __query: function (sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  },
};
