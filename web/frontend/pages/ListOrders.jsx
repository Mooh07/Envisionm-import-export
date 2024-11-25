import {
  TextField,
  IndexTable,
  LegacyCard,
  IndexFilters,
  useSetIndexFiltersMode,
  useIndexResourceState,
  Text,
  ChoiceList,
  RangeSlider,
  Badge,
  useBreakpoints,
  Pagination,
  Card,
  PageActions,
  ButtonGroup,
  Button,
  Page,
  DropZone,
  Link,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { DeleteIcon } from "@shopify/polaris-icons";
import { useQuery } from "react-query";

function IndexTableWithViewsSearchFilterSorting({
  isLoadingOrders,
  orders,
  setQueryInfo,
  queryInfo,
  hasMoreItems,
}) {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const [itemStrings, setItemStrings] = useState(["All"]);
  const deleteView = (index) => {
    const newItemStrings = [...itemStrings];
    newItemStrings.splice(index, 1);
    setItemStrings(newItemStrings);
    setSelected(0);
  };

  const duplicateView = async (name) => {
    setItemStrings([...itemStrings, name]);
    setSelected(itemStrings.length);
    await sleep(1);
    return true;
  };

  const tabs = itemStrings.map((item, index) => ({
    content: item,
    index,
    onAction: () => {},
    id: `${item}-${index}`,
    isLocked: index === 0,
    actions:
      index === 0
        ? []
        : [
            {
              type: "rename",
              onAction: () => {},
              onPrimaryAction: async (value) => {
                const newItemsStrings = tabs.map((item, idx) => {
                  if (idx === index) {
                    return value;
                  }
                  return item.content;
                });
                await sleep(1);
                setItemStrings(newItemsStrings);
                return true;
              },
            },
            {
              type: "duplicate",
              onPrimaryAction: async (value) => {
                await sleep(1);
                duplicateView(value);
                return true;
              },
            },
            {
              type: "edit",
            },
            {
              type: "delete",
              onPrimaryAction: async () => {
                await sleep(1);
                deleteView(index);
                return true;
              },
            },
          ],
  }));
  const [selected, setSelected] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const onCreateNewView = async (value) => {
    await sleep(500);
    setItemStrings([...itemStrings, value]);
    setSelected(itemStrings.length);
    return true;
  };
  const sortOptions = [
    { label: "Date", value: "date asc", directionLabel: "Ascending" },
    { label: "Date", value: "date desc", directionLabel: "Descending" },
  ];
  const [sortSelected, setSortSelected] = useState(["date asc"]);
  const { mode, setMode } = useSetIndexFiltersMode();
  const onHandleCancel = () => {};

  const onHandleSave = async () => {
    await sleep(1);
    return true;
  };

  const primaryAction =
    selected === 0
      ? {
          type: "save-as",
          onAction: onCreateNewView,
          disabled: false,
          loading: false,
        }
      : {
          type: "save",
          onAction: onHandleSave,
          disabled: false,
          loading: false,
        };
  const [accountStatus, setAccountStatus] = useState(undefined);
  const [moneySpent, setMoneySpent] = useState(undefined);
  const [taggedWith, setTaggedWith] = useState("");
  const [queryValue, setQueryValue] = useState("");

  const handleAccountStatusChange = useCallback(
    (value) => setAccountStatus(value),
    []
  );
  const handleMoneySpentChange = useCallback(
    (value) => setMoneySpent(value),
    []
  );
  const handleTaggedWithChange = useCallback(
    (value) => setTaggedWith(value),
    []
  );
  const handleFiltersQueryChange = useCallback((value) => {
    setQueryValue(value);
  }, []);
  const handleAccountStatusRemove = useCallback(
    () => setAccountStatus(undefined),
    []
  );
  const handleMoneySpentRemove = useCallback(
    () => setMoneySpent(undefined),
    []
  );
  const handleTaggedWithRemove = useCallback(() => setTaggedWith(""), []);
  const handleQueryValueRemove = useCallback(() => setQueryValue(""), []);
  const handleFiltersClearAll = useCallback(() => {
    handleAccountStatusRemove();
    handleMoneySpentRemove();
    handleTaggedWithRemove();
    handleQueryValueRemove();
  }, [
    handleAccountStatusRemove,
    handleMoneySpentRemove,
    handleQueryValueRemove,
    handleTaggedWithRemove,
  ]);

  const filters = [
    {
      key: "accountStatus",
      label: "Account status",
      filter: (
        <ChoiceList
          title="Account status"
          titleHidden
          choices={[
            { label: "Enabled", value: "enabled" },
            { label: "Not invited", value: "not invited" },
            { label: "Invited", value: "invited" },
            { label: "Declined", value: "declined" },
          ]}
          selected={accountStatus || []}
          onChange={handleAccountStatusChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: "taggedWith",
      label: "Tagged with",
      filter: (
        <TextField
          label="Tagged with"
          value={taggedWith}
          onChange={handleTaggedWithChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
    {
      key: "moneySpent",
      label: "Money spent",
      filter: (
        <RangeSlider
          label="Money spent is between"
          labelHidden
          value={moneySpent || [0, 500]}
          prefix="$"
          output
          min={0}
          max={2000}
          step={1}
          onChange={handleMoneySpentChange}
        />
      ),
    },
  ];

  const appliedFilters = [];

  if (!isEmpty(taggedWith)) {
    const key = "taggedWith";
    appliedFilters.push({
      key,
      label: disambiguateLabel(key, taggedWith),
      onRemove: handleTaggedWithRemove,
    });
  }
  const resourceName = {
    singular: "order",
    plural: "orders",
  };
  const promotedBulkActions = [
    {
      content: "Download corresponding CSVs",
      onAction: async () => {
        shopify.toast.show(
          "Please wait a couple of seconds, the files are being generated, don't leave the page",
          { duration: 1000 * 15 }
        );
        let data = {
          ordersNumbersToBeFiltered: selectedResources,
          allSelected: allResourcesSelected,
          ...queryInfo,
        };
        try {
          await fetch("/api/orders/generateCSVs", {
            method: "post",
            body: JSON.stringify(data),
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (error) {}
      },
    },
  ];

  const {
    selectedResources,
    clearSelection,
    allResourcesSelected,
    handleSelectionChange,
  } = useIndexResourceState(orders, {
    resourceIDResolver: (resource) => {
      return resource.order_number;
    },
  });
  const rowMarkup = orders.map(
    (
      {
        customer_email,
        customer_graphql_admin_id,
        full_name,
        order_number,
        created_at,
        fulfillment_status,
        order_graphql_admin_id,
      },
      index
    ) => (
      <IndexTable.Row
        id={order_number}
        key={order_number}
        selected={selectedResources.includes(order_number)}
        position={index}
      >
        <IndexTable.Cell>
          <Link
            url={`https://admin.shopify.com/store/377a43-4/orders/${order_graphql_admin_id.replace(
              "gid://shopify/Order/",
              ""
            )}`}
            dataPrimaryLink={true}
            monochrome={true}
            target="_blank"
          >
            <Text variant="bodyMd" fontWeight="bold" as="span">
              {order_number}
            </Text>
          </Link>
        </IndexTable.Cell>
        <IndexTable.Cell>{new Date(created_at).toDateString()}</IndexTable.Cell>
        <IndexTable.Cell>{full_name}</IndexTable.Cell>

        <IndexTable.Cell>
          {fulfillment_status == "FULFILLED" ? (
            <Badge progress="complete">Fulfilled</Badge>
          ) : (
            <Badge progress="incomplete" tone="attention">
              Unfulfilled
            </Badge>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Card padding={0}>
      <IndexFilters
        // loading={tableLoading}
        // sortOptions={sortOptions}
        // sortSelected={sortSelected}
        // queryValue={queryValue}
        // queryPlaceholder="Searching in all"
        // onQueryChange={handleFiltersQueryChange}
        // onQueryClear={() => setQueryValue("")}
        // onSort={setSortSelected}
        primaryAction={primaryAction}
        cancelAction={{
          onAction: onHandleCancel,
          disabled: false,
          loading: false,
        }}
        loading={isLoadingOrders}
        tabs={tabs}
        selected={selected}
        onSelect={setSelected}
        // mode={mode}
        // setMode={setMode}
        // canCreateNewView
        // onCreateNewView={onCreateNewView}
        // filters={filters}
        // appliedFilters={appliedFilters}
        // onClearAll={handleFiltersClearAll}
      />
      <IndexTable
        pagination={{
          hasNext: hasMoreItems,
          hasPrevious: queryInfo.currentPage > 1,
          onNext: () => {
            setQueryInfo((state) => ({
              ...state,
              currentPage: state.currentPage + 1,
            }));
          },
          onPrevious: () => {
            setQueryInfo((state) => ({
              ...state,
              currentPage: state.currentPage - 1,
            }));
          },
        }}
        promotedBulkActions={promotedBulkActions}
        loading={isLoadingOrders}
        condensed={useBreakpoints().smDown}
        resourceName={resourceName}
        itemCount={orders.length}
        selectedItemsCount={
          allResourcesSelected ? "All" : selectedResources.length
        }
        hasMoreItems={hasMoreItems || queryInfo.currentPage > 1}
        onSelectionChange={handleSelectionChange}
        headings={[
          { title: "Order" },
          { title: "Date" },
          { title: "Customer" },
          { title: "Fulfillment status" },
        ]}
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );

  function disambiguateLabel(key, value) {
    switch (key) {
      case "moneySpent":
        return `Money spent is between $${value[0]} and $${value[1]}`;
      case "taggedWith":
        return `Tagged with ${value}`;
      case "accountStatus":
        return value.map((val) => `Customer ${val}`).join(", ");
      default:
        return value;
    }
  }

  function isEmpty(value) {
    if (Array.isArray(value)) {
      return value.length === 0;
    } else {
      return value === "" || value == null;
    }
  }
}

const ListOrders = () => {
  const [queryInfo, setQueryInfo] = useState({
    currentPage: 1,
    maxPerPage: 50,
    startDate: null,
    endDate: null,
    name: "",
    fulfillmentStatus: null,
  });
  const [isFulfillingOrders, setIsFulfillingOrders] = useState(false);
  const [ordersToFUlfillMap, setOrdersToFulfilMap] = useState(null);
  const {
    data,
    refetch: refetchOrders,
    isLoading: isLoadingOrders,
    isFetched,
    isRefetching,
  } = useQuery({
    queryKey: ["ordersAll", queryInfo.currentPage, queryInfo.maxPerPage],

    queryFn: async (context) => {
      let orderNumbers = null;
      console.log(ordersToFUlfillMap);
      if (ordersToFUlfillMap) {
        orderNumbers = Object.keys(ordersToFUlfillMap);
      }
      var response = await fetch(`/api/orders/all`, {
        method: "post",
        body: JSON.stringify({
          ...queryInfo,
          orderNumbers: orderNumbers,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (response.ok) return await response.json();
      else return { orders: [] };
    },
    refetchOnWindowFocus: false,
    keepPreviousData: true,
    staleTime: 1000 * 120,
    cacheTime: 1000 * 120,
  });
  useEffect(() => {
    refetchOrders();
  }, [ordersToFUlfillMap]);
  return (
    <Page
      title="Orders"
      primaryAction={{
        content: "Fulfill orders",
        loading: isFulfillingOrders,
        disabled: ordersToFUlfillMap ? false : true,
        onAction: async () => {
          shopify.toast.show(
            "Orders are being fulfilled, you can leave the page if you want",
            { duration: 1000 * 15 }
          );
          setIsFulfillingOrders(true);
          try {
            await fetch("/api/orders/setFulfilled", {
              method: "post",
              body: JSON.stringify({ ordersToFUlfillMap: ordersToFUlfillMap }),
              headers: {
                "Content-Type": "application/json",
              },
            });
          } catch (error) {}
          setIsFulfillingOrders(false);
          shopify.toast.show(
            "Orders have been fulfilled succesfully, please check if any order was missed and do it manually or edit the file and upload again",
            { duration: 1000 * 15 }
          );
        },
      }}
      secondaryActions={
        <div style={{ display: "flex", gap: 8 }}>
          {ordersToFUlfillMap && (
            <Button onClick={() => setOrdersToFulfilMap(null)}>CLEAR</Button>
          )}
          <div style={{ width: 40, height: 40 }}>
            <DropZone
              onDrop={(_dropFiles, acceptedFiles, _rejectedFiles) => {
                const file = acceptedFiles[0];
                if (file && file.type === "text/plain") {
                  let ordersToFulfillMap = {};
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    event.target.result.split("\n").forEach((item, index) => {
                      if (index == 0) return;
                      if (item.length <= 0) return;
                      let cleanRow = item.replaceAll('"', "").split(",");
                      if (!cleanRow[5] || !cleanRow[0])
                        shopify.toast.show(
                          "An item you included in the file either doesn't have its tracking number or order number, please after uploading double check all orders to make sure they got fulfilled",
                          { duration: 1000 * 15 }
                        );
                      ordersToFulfillMap[cleanRow[0]] = cleanRow[5];
                    });
                    console.log(ordersToFUlfillMap);
                    setOrdersToFulfilMap(ordersToFulfillMap);
                  };
                  reader.onerror = (error) => {
                    console.error("Error reading file:", error);
                  };
                  reader.readAsText(file); // Read file as plain text
                } else {
                  console.error(
                    "Unsupported file type. Please upload a .txt file."
                  );
                }
              }}
            >
              <DropZone.FileUpload />
            </DropZone>
          </div>
        </div>
      }
      // actionGroups={[
      //   {
      //     title: "Promote",
      //     actions: [
      //       {
      //         content: "Share on Facebook",
      //         accessibilityLabel: "Individual action label",
      //         onAction: () => alert("Share on Facebook action"),
      //       },
      //     ],
      //   },
      // ]}
      fullWidth={true}
    >
      {/* <Card background="transparent" >
        <ButtonGroup>
          <Button>Cancel</Button>
          <Button variant="primary">Save</Button>
        </ButtonGroup>
      </Card> */}
      <IndexTableWithViewsSearchFilterSorting
        isLoadingOrders={isLoadingOrders || isRefetching}
        orders={data ? data.orders : []}
        setQueryInfo={setQueryInfo}
        queryInfo={queryInfo}
        hasMoreItems={data ? data.hasMoreItems : false}
      ></IndexTableWithViewsSearchFilterSorting>
    </Page>
  );
};

export default ListOrders;
