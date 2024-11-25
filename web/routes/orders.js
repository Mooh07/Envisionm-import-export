import { createObjectCsvWriter } from "csv-writer";
import { ordersDB } from "../database/orders.js";
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
  console.log(_req.body);
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
  console.log(data);
  res.status(200).send({ orders: data, hasMoreItems: hasMoreItems });
};
let csvWriterOrderShippingWriterGenerator = () => {
  return createObjectCsvWriter({
    append: false,
    path: "./frontend/assets/ordersGenerator.csv",
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
    path: "./frontend/assets/lineItemsCSV.csv",
    header: [
      {
        id: "Ord#",
        title: "Ord#",
      },
      { id: "quantity", title: "Quantity" },
      { id: "ProductID", title: "ProductID" },
    ],
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
              }
          }
        }
      `;
  });
  getOrderQuery += `}`;
  return getOrderQuery;
};
const generateCSV = async (orders, graphQlClient) => {
  const BATCH_SIZE = 100;
  let finalCSVOrderArray = [];
  let finalCSVLineItemArray = [];

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const currentBatch = orders.slice(i, i + BATCH_SIZE);
    const getOrdersQuery = getOrdersQueryGenerator(currentBatch);
    try {
      const response = await graphQlClient.request(getOrdersQuery);
      //   console.log(`Batch ${i / BATCH_SIZE + 1} response:`, response);
      Object.keys(response.data).forEach((key) => {
        // if (!response.data[key].fulfillable) return;
        finalCSVOrderArray.push({
          "Ord#": response.data[key].name.replace("#", ""),
          Ship_To_Name: response.data[key].shippingAddress.name,
          Address1: response.data[key].shippingAddress.address1,
          Address2: response.data[key].shippingAddress.address1
            ? response.data[key].shippingAddress.address1
            : "",
          City: response.data[key].shippingAddress.city,
          State: response.data[key].shippingAddress.provinceCode,
          "Ship Method": response.data[key]?.shippingLine?.code,
          Store_ID: "clance.com",
          Store_Link: "support@clance.com",
        });
        response.data[key].lineItems.nodes.forEach((item) => {
          finalCSVLineItemArray.push({
            "Ord#": response.data[key].name.replace("#", ""),
            quantity: item.quantity,
            ProductID: item.sku,
          });
        });
      });
      //   console.log(finalCSVOrderArray);
    } catch (error) {
      console.error(`Error in batch ${i / BATCH_SIZE + 1}:`, error);
    }
  }
  //   console.log(finalCsvArray);
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
        console.log(orderObject);
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
      console.log(arrayOfOrdersFulfilled);
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
