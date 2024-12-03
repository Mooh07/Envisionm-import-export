import { createObjectCsvWriter } from "csv-writer";
import { ordersDB } from "../database/orders.js";
import fs from "fs";
import csv from "csv-parser";
import shopify from "../shopify.js";
import {
  getOrdersQuery,
  getUpdateCustomerQuery,
} from "../queriesGenerators.js";
// Constants
export const locationShippingInfo = {
  Monroe: {
    Address1: "1 Preshburg Blvd",
    City: "Kiryas Joel",
    State: "NY",
    Zip: "10950",
    location_id: "75969331397",
  },
  Monsey: {
    Address1: "75 NY-59",
    City: "monsey",
    State: "NY",
    Zip: "10952",
    location_id: "75969265861",
  },
  Flushing: {
    Address1: "579 Flushing Ave",
    City: "Brooklyn",
    State: "NY",
    Zip: "11205",
    location_id: "75969233093",
  },
  Wallabout: {
    Address1: "271 Wallabout St",
    City: "Brooklyn",
    State: "NY",
    Zip: "11206",
    location_id: "75969298629",
  },
};
// Helpers

let csvWriterOrderShippingWriterGenerator = () => {
  return createObjectCsvWriter({
    append: false,
    path:
      process.env.NODE_ENV == "production"
        ? "./frontend/dist/ordersShippment.csv"
        : "./frontend/assets/ordersShippment.csv",
    header: [
      {
        id: "Ord#",
        title: "Ord#",
      },
      {
        id: "Ship_To_Name",
        title: "Ship_To_Name",
      },
      {
        id: "Address1",
        title: "Address1",
      },
      {
        id: "Zip",
        title: "Zip",
      },
      {
        id: "Address2",
        title: "Address2",
      },
      { id: "City", title: "City" },
      { id: "State", title: "State" },
      { id: "Ship Method", title: "Ship Method" },
      { id: "Store_ID", title: "Store_ID" },
      { id: "Store_Link", title: "Store_Link" },
    ],
  });
};
let csvWriterLineItemsCSV = () => {
  return createObjectCsvWriter({
    append: false,
    path:
      process.env.NODE_ENV == "production"
        ? "./frontend/dist/lineItemsCSV.csv"
        : "./frontend/assets/lineItemsCSV.csv",
    header: [
      {
        id: "Ord#",
        title: "Ord#",
      },
      { id: "Line#", title: "Line#" },
      { id: "Quantity", title: "Quantity" },
      { id: "UPC", title: "UPC" },
      { id: "POWER", title: "POWER" },
      { id: "BC", title: "BC" },
      { id: "DIAMETER", title: "DIAMETER" },
      { id: "CYL", title: "CYL" },
      { id: "AXIS", title: "AXIS" },
      { id: "COLOR", title: "COLOR" },
      { id: "SAMPLE", title: "SAMPLE" },
      { id: "ADD", title: "ADD" },
      { id: "Patient", title: "Patient" },
    ],
  });
};
const readSkusCsvFile = (fileToRead) => {
  return new Promise((resolve, reject) => {
    const arrayOfProducts = [];
    let objOfProduct = {};
    fs.createReadStream(fileToRead)
      .pipe(csv())
      .on("data", (row) => {
        arrayOfProducts.push(row);
        if (!objOfProduct[row["product_name"]]) {
          objOfProduct[row["product_name"]] = {};
        }
        objOfProduct[row["product_name"]][row["upc_sku"]] = row;
      })
      .on("end", () => {
        console.log(`Done reading ${fileToRead}`);
        resolve(objOfProduct);
      })
      .on("error", (error) => {
        console.error(`Error reading CSV file: ${error.message}`);
        reject(error); // Reject the promise with the error
      });
  });
};

const generateCSV = async (orders, graphQlClient) => {
  const BATCH_SIZE = 10;
  let finalCSVOrderArray = [];
  let finalCSVLineItemArray = [];
  let ordersToBeFulfilled = [];

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const currentBatch = orders.slice(i, i + BATCH_SIZE);
    const ordersQuery = getOrdersQuery(currentBatch);
    try {
      const response = await graphQlClient.request(ordersQuery);
      //   console.log(`Batch ${i / BATCH_SIZE + 1} response:`, response);
      Object.keys(response.data).forEach(async (key) => {
        let orderQueryResponse = response.data[key];
        console.log(orderQueryResponse);
        if (!orderQueryResponse.fulfillable) {
          ordersToBeFulfilled.push(orderQueryResponse.name.replace("#", ""));
          return;
        }
        let finalOrderCSVobj = {};
        if (orderQueryResponse.deliveryLocation.value == "Shipping") {
          finalOrderCSVobj = {
            "Ord#": orderQueryResponse.name.replace("#", ""),
            Ship_To_Name: orderQueryResponse.shippingAddress.name,
            Address1: orderQueryResponse.shippingAddress.address1,
            Address2: orderQueryResponse.shippingAddress.address1
              ? orderQueryResponse.shippingAddress.address1
              : "",
            City: orderQueryResponse.shippingAddress.city,
            State: orderQueryResponse.shippingAddress.provinceCode,
            "Ship Method": orderQueryResponse?.shippingLine?.code,
            Zip: orderQueryResponse.shippingAddress.zip,

            Store_ID: "envisionm.com",
            Store_Link: "Lenses@envisionoptical.com",
          };
        } else {
          finalOrderCSVobj = {
            "Ord#": orderQueryResponse.name.replace("#", ""),
            Ship_To_Name: orderQueryResponse.deliveryLocation.value,
            Address2: "",
            ...locationShippingInfo[orderQueryResponse.deliveryLocation.value],
            "Ship Method": orderQueryResponse?.shippingLine?.code,
            Store_ID: "envisionm.com",
            Store_Link: "Lenses@envisionoptical.com",
          };
        }
        finalCSVOrderArray.push(finalOrderCSVobj);
        let tagsUpdateValues = [];
        let line = 0;
        orderQueryResponse.lineItems.nodes.forEach(async (lineItem) => {
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
          finalCSVLineItemArray.push({
            "Ord#": orderQueryResponse.name.replace("#", ""),
            Quantity: lineItem.quantity,
            UPC: sku,
            Description: eye == "Left" ? "Right Eye (OD)" : "Left Eye (OS)",
            power: power == "@" ? "" : power,
            BC: BC == "@" ? "" : BC,
            DIAMETER: diameter == "@" ? "" : diameter,
            CYL: Cylinder == "@" ? "" : Cylinder,
            AXIS: Axis == "@" ? "" : Axis,
            ADD: ADD == "@" ? "" : ADD,
            Patient: orderQueryResponse.shippingAddress.name,
            "Line#": line,
          });
          const customerUpdateQuery = getUpdateCustomerQuery();
          let customerID = orderQueryResponse.customer.id;
          let eyeTag = `${eye}: power= ${power ? power : "@"} & BC= ${
            BC ? BC : "@"
          } & diameter= ${diameter ? diameter : "@"} & cylinder= ${
            Cylinder ? Cylinder : "@"
          } & axis= ${Axis ? Axis : "@"} & ADD= ${ADD ? ADD : "@"}`;

          tagsUpdateValues.push(eyeTag);
          const customerUpdateVariables = {
            input: {
              id: customerID,
              tags: tagsUpdateValues,
            },
          };
          const customerUpdateResponse = await graphQlClient.request(
            customerUpdateQuery,
            {
              variables: customerUpdateVariables,
            }
          );
        });
        // console.log(customerUpdateResponse);
      });
      //   console.log(finalCSVOrderArray);
    } catch (error) {
      console.error(`Error in batch ${i / BATCH_SIZE + 1}:`, error);
    }
  }
  await ordersDB.setOrdersToFulfilled(ordersToBeFulfilled);

  csvWriterOrderShippingWriterGenerator()
    .writeRecords(finalCSVOrderArray)
    .then(() => {
      console.log("done writing order csv");
    });
  csvWriterLineItemsCSV()
    .writeRecords(finalCSVLineItemArray)
    .then(() => {
      console.log("done writing line items csv");
    });
};
const fulfillOrders = async (orders, ordersToFUlfillMap, graphQlClient) => {
  const BATCH_SIZE = 100;
  const fulfillOrderMutation = `mutation fulfillmentCreateV2($fulfillment: FulfillmentV2Input!) {
  fulfillmentCreateV2(fulfillment: $fulfillment) {
    fulfillment {
      id
      status
    }
    userErrors {
      field
      message
    }
  }
}`;
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    let arrayOfOrdersFulfilled = [];
    const currentBatch = orders.slice(i, i + BATCH_SIZE);
    const getOrdersQuery = getOrdersQueryGenerator(currentBatch);

    try {
      const ordersResponse = await graphQlClient.request(getOrdersQuery);

      // Iterate over keys using a for loop
      const keys = Object.keys(ordersResponse.data);
      for (let j = 0; j < keys.length; j++) {
        const key = keys[j];
        const orderObject = ordersResponse.data[key];
        // remove the default # of shopify
        orderObject.name = orderObject.name.replace("#", "");
        // console.log(ordersToFUlfillMap);
        if (!orderObject.fulfillable) {
          arrayOfOrdersFulfilled.push(orderObject.name);
          continue;
        }
        let fulfillmentVariables = {
          fulfillment: {
            lineItemsByFulfillmentOrder: {
              fulfillmentOrderId:
                orderObject.fulfillmentOrders.edges[
                  orderObject.fulfillmentOrders.edges.length - 1
                ].node.id,
            },
            notifyCustomer: true,
            trackingInfo: {
              number: ordersToFUlfillMap[orderObject.name],
            },
          },
        };
        const {
          data: { fulfillmentCreateV2 },
        } = await graphQlClient.request(fulfillOrderMutation, {
          variables: fulfillmentVariables,
        });
        if (fulfillmentCreateV2.fulfillment.id) {
          arrayOfOrdersFulfilled.push(orderObject.name);
        }
      }
      let result = await ordersDB.setOrdersToFulfilled(arrayOfOrdersFulfilled);
      console.log(result);
    } catch (error) {
      console.error(`Error in batch ${i / BATCH_SIZE + 1}:`, error);
    }
  }
};

// Routes
export const listOrders = async (_req, res) => {
  const {
    orderNumbers,
    allSelected,
    currentPage,
    maxPerPage,
    startDate,
    endDate,
    name,
    fulfillmentStatus,
  } = _req.body;
  let { data, hasMoreItems } = await ordersDB.listFilteredCustomersAndOrders({
    // @ts-ignore
    currentPage: parseInt(currentPage),
    // @ts-ignore
    maxPerPage: parseInt(maxPerPage),
    orderNumbers: orderNumbers,
    startDate: startDate,
    endDate: endDate,
    name: name,
    fulfillmentStatus: fulfillmentStatus,
  });
  res.status(200).send({ orders: data, hasMoreItems: hasMoreItems });
};

export const queryProductsAndGenerateCSV = async (_req, res) => {
  const {
    ordersNumbersToBeFiltered,
    allSelected,
    currentPage,
    maxPerPage,
    startDate,
    endDate,
    name,
    fulfillmentStatus,
  } = _req.body;
  if (allSelected) {
    var result = await ordersDB.listFilteredCustomersAndOrders({
      startDate,
      endDate,
      name: name,
      fulfillmentStatus: fulfillmentStatus,
    });
  } else
    var result = await ordersDB.listFilteredCustomersAndOrders({
      orderNumbers: ordersNumbersToBeFiltered,
    });
  console.log(res.locals.shopify.session);

  const graphQlClient = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });
  await generateCSV(result.data, graphQlClient);
  res.status(200).send({ success: true });
};

export const queryProductsAndSetFulfilled = async (_req, res) => {
  const { ordersToFUlfillMap } = _req.body;
  let orderNumbers = Object.keys(ordersToFUlfillMap);
  var result = await ordersDB.listFilteredCustomersAndOrders({
    orderNumbers: orderNumbers,
  });

  const graphQlClient = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });
  let resultOfFullfilment = await fulfillOrders(
    result.data,
    ordersToFUlfillMap,
    graphQlClient
  );
  res.status(200).send({ success: true });
};
