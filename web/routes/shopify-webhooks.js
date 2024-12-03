// Contains webhooks for any service we use, shopify, klaviyo...
import express from "express";
import * as dotenv from "dotenv";
import crypto from "crypto";
import { ordersDB } from "../database/orders.js";
import shopify from "../shopify.js";
import { locationShippingInfo } from "./orders.js";
import {
  getOrderQuery,
  getProductByHandleQuery,
  inventoryAdjustMutation,
  setTagsMutation,
} from "../queriesGenerators.js";
const SHARED_KEY_FOR_HOOKS =
  process.env.SHARED_KEY_FOR_HOOKS ||
  "ceb4d9a203e649b6303197931afa8869c5d10b40876615d3994c858032343f87";
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
function handlelize(str) {
  str = str
    .normalize("NFD")
    .replace(/[\[\]'()"]+/g, "") // Remove apostrophes, square brackets, and other bits and pieces
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/([^\w]+|\s+)/g, "-") // Replace space and other characters by hyphen
    .replace(/\-\-+/g, "-") // Replaces multiple hyphens by one hyphen
    .replace(/(^-+|-+$)/g, "") // Remove extra hyphens from beginning or end of the string
    .toLowerCase(); // To lowercase

  return str;
}
export default (app) => {
  app.use(
    express.json({
      limit: "5mb",
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      },
    })
  );
  const saveOrderDataToDatabase = async (req, res) => {
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
      store_id: "envisionm.com",
      store_link: "lenses@envisionoptical.com",
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
      store_id: "envisionm.com",
      order_number: orderData.order_number,
      store_link: "lenses@envisionoptical.com",
    });

    console.log("done creating order row in database;");
  };
  const tagManuallyFulfilledOrders = async (req, res) => {
    let session = {
      id: "offline_envisionm.myshopify.com",
      shop: "envisionm.myshopify.com",
      state: "898081857833406",
      isOnline: false,
      scope:
        "read_locations,read_assigned_fulfillment_orders,read_customers,read_fulfillments,read_inventory,read_merchant_managed_fulfillment_orders,read_metaobjects,read_orders,read_products,read_third_party_fulfillment_orders,write_assigned_fulfillment_orders,write_customers,write_fulfillments,write_inventory,write_merchant_managed_fulfillment_orders,write_metaobjects,write_orders,write_third_party_fulfillment_orders",
      expires: undefined,
      accessToken: "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",
      onlineAccessInfo: undefined,
    };
    const graphQlClient = new shopify.api.clients.Graphql({
      session: session,
    });

    const orderID = "gid://shopify/Order/5591635099845";
    let orderQuery = getOrderQuery(orderID);
    let correspondingOrder = await graphQlClient.request(orderQuery);
    const dropOfLocationAttribute =
      correspondingOrder.data.order.customAttributes.filter(
        (attribute) => attribute.key == "Drop off location"
      )[0];
    if (!locationShippingInfo[dropOfLocationAttribute.value]) return;
    let updateObject = {};
    let orderManuallyFulfilled = true;

    for (
      let i = 0;
      i < correspondingOrder.data.order.lineItems.nodes.length;
      i++
    ) {
      const lineItem = correspondingOrder.data.order.lineItems.nodes[i];
      const { product } = lineItem;
      let [
        { value: power },
        { value: diameter },
        { value: BC },
        { value: Cylinder },
        { value: Axis },
        { value: ADD },
        { value: sku },
        { value: eye },
      ] = lineItem.customAttributes;
      const productByHandleQuery = getProductByHandleQuery(
        handlelize(`${product.title} SKU:${sku}`)
      );
      let correspondingInventoryProduct = await graphQlClient.request(
        productByHandleQuery
      );
      if (!correspondingInventoryProduct.data.productByHandle) {
        // TODO: tag orders
        return;
      }
      const {
        productByHandle: { variants },
      } = correspondingInventoryProduct.data;
      variants.nodes[0].inventoryItem.inventoryLevels.nodes.forEach(
        async (item) => {
          const locationID = item.location.id.replace(
            "gid://shopify/Location/",
            ""
          );
          const inventoryAvailableQuantityInLocation =
            item.quantities[0].quantity;
          if (
            locationID !=
            locationShippingInfo[dropOfLocationAttribute.value].location_id
          )
            return;
          if (!updateObject[sku]) {
            updateObject[sku] = {
              quantity: lineItem.quantity,
            };
          } else {
            updateObject[sku].quantity =
              updateObject[sku].quantity + lineItem.quantity;
          }

          if (updateObject[sku].quantity > inventoryAvailableQuantityInLocation)
            orderManuallyFulfilled = false;

          let delta = -lineItem.quantity;
          let inventoryItemId = variants.nodes[0].inventoryItem.id;
          updateObject[sku].variables = {
            delta: -updateObject[sku].quantity,
            inventoryItemId,
            location_id: item.location.id,
          };
        }
      );
      if (!orderManuallyFulfilled) return;
    }
    let updateKeys = Object.keys(updateObject);
    for (let index = 0; index < updateKeys.length; index++) {
      let updateInventoryObject = updateObject[updateKeys[index]];
      let reason = "correction";
      let name = "available";
      await graphQlClient.request(inventoryAdjustMutation().mutation, {
        variables: inventoryAdjustMutation(
          reason,
          name,
          updateInventoryObject.variables.delta,
          updateInventoryObject.variables.inventoryItemId,
          updateInventoryObject.variables.location_id
        ).variables,
      });
    }
    await graphQlClient.request(setTagsMutation().mutation, {
      variables: setTagsMutation(orderID, "MANUALLY_FULFILL").variables,
    });
  };
  app.post(
    "/api/webhooks/orderCreated",
    isValidShopifyWebHook,
    async (req, res) => {
      await saveOrderDataToDatabase();
      await tagManuallyFulfilledOrders();
    }
  );
};
