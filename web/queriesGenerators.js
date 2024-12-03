export const getProductByHandleQuery = (handle) => {
  return `query {
          productByHandle(handle: "${handle}") {
            id
            title
            productType
            description
            vendor
            variants(first:1){
            nodes{
              id
              inventoryQuantity
              inventoryItem {
                id
                sku
                inventoryLevels(first:5){
                  nodes{
                  location{
                  id}
                    id
                    quantities(names:["available"]){
                      quantity
                      id
                    }
                  }
                }
              }
              }
            }
          }
        }`;
};

export const getOrderQuery = (id) => {
  return `query {
                  order(id: "${id}") {
                    name
                    customAttributes{
                        key
                        value
                    }
                    lineItems(first:50){
                      nodes {
                        id
                        quantity
                        product{
                          title
                        }
                          customAttributes{
                          value
                          key}
                      }
                    }
                  }
            }`;
};
export const getOrdersQuery = (orders) => {
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
          customAttributes{
            value
            key
          }
          fulfillmentOrders (first:50) {
              edges {
                  node {
                      id
                  }
                      
              }
          }
          fulfillable
          displayFulfillmentStatus
          shippingAddress {
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
                  customAttributes{
                    value
                    key
                  }
              }
          }
        }
      `;
  });
  getOrderQuery += `}`;
  return getOrderQuery;
};

export const getUpdateCustomerQuery = () => {
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
export const setTagsMutation = (resourceID, tags) => {
  return {
    mutation: `mutation addTags($id: ID!, $tags: [String!]!) {
  tagsAdd(id: $id, tags: $tags) {
    node {
      id
    }
    userErrors {
      message
    }
  }
}`,
    variables: {
      id: resourceID,
      tags: tags,
    },
  };
};
export const inventoryAdjustMutation = (
  reason,
  name,
  delta,
  inventoryItemId,
  locationId
) => {
  return {
    variables: {
      input: {
        reason,
        name,
        changes: [
          {
            delta,
            inventoryItemId,
            locationId,
          },
        ],
      },
    },
    mutation: `
    mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
        inventoryAdjustQuantities(input: $input) {
          userErrors {
            field
            message
          }
          inventoryAdjustmentGroup {
            createdAt
            changes {
              name
              delta
            }
          }
        
      }
}
  `,
  };
};
