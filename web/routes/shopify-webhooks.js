// Contains webhooks for any service we use, shopify, klaviyo...
import express from "express";
import * as dotenv from "dotenv";
import crypto from "crypto";
import { ordersDB } from "../database/orders.js";
const SHARED_KEY_FOR_HOOKS =
  process.env.SHARED_KEY_FOR_HOOKS ||
  "bcc788287afc6a7e2576e98483010af5c759916df9b670efc974a4a086c625a9";
dotenv.config();
const validateHmac = (hmac, body, key) => {
  const safeCompare = (hmac, queryStr, key) => {
    return (
      hmac ===
      crypto.createHmac("SHA256", key).update(queryStr).digest("base64")
    );
  };

  return safeCompare(hmac, body, key);
};
const isValidShopifyWebHook = (req, res, next) => {
  const isValidRequest = validateHmac(
    req.headers["x-shopify-hmac-sha256"],
    req.rawBody,
    SHARED_KEY_FOR_HOOKS
  );
  res.status(200).send({ ID: 1 });
  if (!isValidRequest) {
    return;
  }
  next();
};
export default (app) => {
  app.use(
    express.json({
      limit: "5mb",
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );

  app.post(
    "/api/webhooks/orderCreated",
    isValidShopifyWebHook,
    async (req, res) => {
      let orderData = {
        shipping: {
          full_name: req.body.shipping_address.first_name,
          address1: req.body.shipping_address.address1,
          address2: req.body.shipping_address.address2,
          city: req.body.shipping_address.city,
          zip: req.body.shipping_address.zip,
          state: req.body.shipping_address.province_code,
          country: req.body.shipping_address.country_code,
          ship_method: "Standard",
        },
        store_id: "clance.com",
        store_link: "support@clance.com",
        order_number: req.body.name.replace("#", ""),
        shopify_admin_id: req.body.admin_graphql_api_id,
        created_at: req.body.created_at,
        customer: {
          email: req.body.customer.email,
          shopify_admin_id: req.body.customer.admin_graphql_api_id,
          full_name: req.body.customer.first_name,
        },
      };
      if (req.body.customer.last_name)
        orderData.customer.full_name = `${orderData.customer.full_name} ${req.body.customer.last_name}`;
      if (req.body.shipping_address.last_name)
        orderData.shipping.full_name = `${orderData.shipping.full_name} ${req.body.shipping_address.last_name}`;

      await ordersDB.createCustomer({
        customer_email: orderData.customer.email,
        full_name: orderData.customer.full_name,
        customer_graphql_admin_id: orderData.customer.shopify_admin_id,
      });
      await ordersDB.createOrder({
        created_at: orderData.created_at,
        customer_graphql_admin_id: orderData.customer.shopify_admin_id,
        fulfillment_status: "UNFULFILLED",
        order_graphql_admin_id: orderData.shopify_admin_id,
        store_id: "clance.com",
        order_number: orderData.order_number,
        store_link: "support@clance.com",
      });
      console.log("done creating order row in database;");
    }
  );
};
