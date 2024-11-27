import { createObjectCsvWriter } from "csv-writer";
import { ordersDB } from "../database/orders.js";
import fs from "fs";
import csv from "csv-parser";
import shopify from "../shopify.js";
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
const getOrdersQueryGenerator = (orders) => {
  let getOrderQuery = `query {`;
  orders.forEach((order, index) => {
    getOrderQuery += `
        order${index + 1}: order(id: "${order.order_graphql_admin_id}") {
          name
          shippingLine{
              carrierIdentifier
              source
              code
              id
          }
          customer{
            id
          }
          tags
          deliveryLocation: metafield(namespace: "custom", key:"delivery_location"){
            value
          }
          isTrial: metafield(namespace: "custom", key:"is_this_trial"){
            value
          }
          fulfillmentOrders (first:50) {
              edges {
                  node {
                      id
                       lineItems(first: 50){
                         edges{
                             node{
                                 id
                             }
                         }
                     }
                  }
                      
              }
          }
          fulfillable
          displayFulfillmentStatus
          shippingAddress{
              address1
              address2
              city
              countryCodeV2
              name
              zip
              province
              provinceCode
          }
          lineItems(first:50){
              nodes {
                  sku
                  quantity
                  product{
                    title
                    id
                  }
              }
          }
        }
      `;
  });
  getOrderQuery += `}`;
  return getOrderQuery;
};
const getUpdateCustomerQuery = () => {
  return `mutation updateCustomerMetafields($input: CustomerInput!) {
  customerUpdate(input: $input) {
    customer {
      id
    }
    userErrors {
      message
      field
    }
  }
}`;
};
const locationShippingInfo = {
  Monroe: {
    Address1: "1 Preshburg Blvd",
    City: "Kiryas Joel",
    State: "NY",
    Zip: "10950",
  },
  Monsey: {
    Address1: "75 NY-59",
    City: "monsey",
    State: "NY",
    Zip: "10952",
  },
  Flushing: {
    Address1: "579 Flushing Ave",
    City: "Brooklyn",
    State: "NY",
    Zip: "11205",
  },
  Wallabout: {
    Address1: "271 Wallabout St",
    City: "Brooklyn",
    State: "NY",
    Zip: "11206",
  },
};
const generateCSV = async (orders, graphQlClient) => {
  const BATCH_SIZE = 100;
  let finalCSVOrderArray = [];
  let finalCSVLineItemArray = [];
  let skus = await readSkusCsvFile("./assets/Result_64.csv");
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const currentBatch = orders.slice(i, i + BATCH_SIZE);
    const getOrdersQuery = getOrdersQueryGenerator(currentBatch);
    try {
      const response = await graphQlClient.request(getOrdersQuery);
      //   console.log(`Batch ${i / BATCH_SIZE + 1} response:`, response);
      Object.keys(response.data).forEach(async (key) => {
        if (!response.data[key].fulfillable) return;
        let finalOrderCSVobj = {};
        if (response.data[key].deliveryLocation.value == "Shipping") {
          finalOrderCSVobj = {
            "Ord#": response.data[key].name.replace("#", ""),
            Ship_To_Name: response.data[key].shippingAddress.name,
            Address1: response.data[key].shippingAddress.address1,
            Address2: response.data[key].shippingAddress.address1
              ? response.data[key].shippingAddress.address1
              : "",
            City: response.data[key].shippingAddress.city,
            State: response.data[key].shippingAddress.provinceCode,
            "Ship Method": response.data[key]?.shippingLine?.code,
            Store_ID: "envisionm.com",
            Store_Link: "Lenses@envisionoptical.com",
          };
        } else {
          finalOrderCSVobj = {
            "Ord#": response.data[key].name.replace("#", ""),
            Ship_To_Name: response.data[key].deliveryLocation.value,
            Address2: "",
            ...locationShippingInfo[response.data[key].deliveryLocation.value],
            "Ship Method": "",
            Store_ID: "envisionm.com",
            Store_Link: "Lenses@envisionoptical.com",
          };
        }
        finalCSVOrderArray.push(finalOrderCSVobj);
        let tagsUpdateValues = [];
        let line = 0;
        response.data[key].tags.forEach((tag, index) => {
          if (!tag.includes("right eye") && !tag.includes("left eye")) return;
          line = line + 1;

          let [product_id, sku, eye, quantity] = tag.split(":");
          let correspondingProduct = response.data[key].lineItems.nodes
            .map((lineItem) => lineItem.product)
            .filter((product) => {
              let ID = product.id.replace("gid://shopify/Product/", "");
              return ID == product_id;
            })[0];
          if (!correspondingProduct) {
            // TODO: handle when product doesn't exist
            return;
          }

          let power = skus[correspondingProduct.title][sku].power;
          let BC = skus[correspondingProduct.title][sku].BC;
          let diameter = skus[correspondingProduct.title][sku].diameter;
          let Cylinder = skus[correspondingProduct.title][sku].Cylinder;
          let Axis = skus[correspondingProduct.title][sku].Axis;
          let ADD = skus[correspondingProduct.title][sku].ADD;

          let eyeTag = `${eye}: power= ${power ? power : "@"} & BC= ${
            BC ? BC : "@"
          } & diameter= ${diameter ? diameter : "@"} & cylinder= ${
            Cylinder ? Cylinder : "@"
          } & axis= ${Axis ? Axis : "@"} & ADD= ${ADD ? ADD : "@"}`;

          tagsUpdateValues.push(eyeTag);

          finalCSVLineItemArray.push({
            "Ord#": response.data[key].name.replace("#", ""),
            Quantity: quantity,
            UPC: sku,
            Description: eye == "left eye" ? "Right Eye (OD)" : "Left Eye (OS)",
            power: power,
            BC: BC,
            DIAMETER: diameter,
            CYL: Cylinder,
            AXIS: Axis,
            ADD: ADD,
            Patient: response.data[key].shippingAddress.name,
            "Line#": line,
          });
        });
        const customerUpdateQuery = getUpdateCustomerQuery();
        let customerID = response.data[key].customer.id;
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
        // console.log(customerUpdateResponse);
      });
      //   console.log(finalCSVOrderArray);
    } catch (error) {
      console.error(`Error in batch ${i / BATCH_SIZE + 1}:`, error);
    }
  }

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
  const graphQlClient = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });
  await generateCSV(result.data, graphQlClient);
  res.status(200).send({ success: true });
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
