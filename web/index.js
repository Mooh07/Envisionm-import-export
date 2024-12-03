// @ts-check
import { ordersDB } from "./database/orders.js";
ordersDB.init(process.env.NODE_ENV != "production").then(async () => {
  if (process.env.NODE_ENV == "production") return;
  await ordersDB.createCustomer({
    customer_email: "nvm2k213@gmail.com",
    full_name: "Tetbirt Mohamed Hassene",
    customer_graphql_admin_id: "gid:/shopify/Customer/7907343990981",
  });
  await ordersDB.createOrder({
    created_at: "2024-10-29T20:37:43-04:00",
    customer_graphql_admin_id: "gid:/shopify/Customer/7907343990981",
    fulfillment_status: "UNFULFILLED",
    store_id: "envisionm.com",
    store_link: "lenses@envisionoptical.com",
    order_number: "1015",
    order_graphql_admin_id: "gid://shopify/Order/5591635099845",
  });
  await ordersDB.listCustomersAndTheirOrders();
  return;
});
import * as dotenv from "dotenv";
dotenv.config();
console.log(process.env);

// import { join } from "path";
// import { readFileSync } from "fs";
// import express from "express";
// import serveStatic from "serve-static";
// import shopifyWebhooks from "./routes/shopify-webhooks.js";
// import shopify from "./shopify.js";
// import PrivacyWebhookHandlers from "./privacy.js";
// import {
//   listOrders,
//   queryProductsAndGenerateCSV,
//   queryProductsAndSetFulfilled,
// } from "./routes/orders.js";

// const PORT = parseInt(
//   process.env.BACKEND_PORT || process.env.PORT || "3000",
//   10
// );

// const STATIC_PATH =
//   process.env.NODE_ENV === "production"
//     ? `${process.cwd()}/frontend/dist`
//     : `${process.cwd()}/frontend/`;

// console.log(ordersDB.db);
// const app = express();
// // cors()
// // app.use(cors());
// // Set up Shopify authentication and webhook handling
// app.get(shopify.config.auth.path, shopify.auth.begin());
// app.get(
//   shopify.config.auth.callbackPath,
//   shopify.auth.callback(),
//   shopify.redirectToShopifyOrAppRoot()
// );
// app.post(
//   shopify.config.webhooks.path,
//   shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
// );

// shopifyWebhooks(app);

// const addSessionShopToReqParams = async (req, res, next) => {
//   const shop = "377a43-4.myshopify.com";
//   if (shop && !req.query.shop) {
//     req.query.shop = shop;
//   }
//   return next();
// };
// // If you are adding routes outside of the /api path, remember to
// // also add a proxy rule for them in web/frontend/vite.config.js
// app.use("/api/*", shopify.validateAuthenticatedSession());

// // app.use("/*", addSessionShopToReqParams);

// app.use(express.json());

// app.post("/api/orders/all", listOrders);
// app.post("/api/orders/generateCSVs", queryProductsAndGenerateCSV);
// app.post("/api/orders/setFulfilled", queryProductsAndSetFulfilled);

// app.get("/api/products/count", async (_req, res) => {
//   const client = new shopify.api.clients.Graphql({
//     session: res.locals.shopify.session,
//   });

//   const countData = await client.request(`
//     query shopifyProductCount {
//       productsCount {
//         count
//       }
//     }
//   `);

//   res.status(200).send({ count: countData.data.productsCount.count });
// });

// app.post("/api/products", async (_req, res) => {
//   let status = 200;
//   let error = null;
//   try {
//     await productCreator(res.locals.shopify.session);
//   } catch (e) {
//     console.log(`Failed to process products/create: ${e.message}`);
//     status = 500;
//     error = e.message;
//   }
//   res.status(status).send({ success: status === 200, error });
// });

// app.use(shopify.cspHeaders());
// app.use(serveStatic(STATIC_PATH, { index: false }));
// console.log(join(STATIC_PATH, "index.html"));
// app.use(
//   "/*",
//   (req, res, next) => {
//     // console.log("before installed on shop:");
//     // console.log(req.query);
//     next();
//   },
//   shopify.ensureInstalledOnShop(),
//   async (_req, res, _next) => {
//     try {
//       res
//         .status(200)
//         .set("Content-Type", "text/html")
//         .send(
//           readFileSync(join(STATIC_PATH, "index.html"))
//             .toString()
//             .replace(
//               "%VITE_SHOPIFY_API_KEY%",
//               process.env.SHOPIFY_API_KEY || ""
//             )
//         );
//     } catch (error) {
//       // _next(error); // Pass errors to Express's error-handling middleware.
//     }
//   }
// );

// app.listen(PORT);
