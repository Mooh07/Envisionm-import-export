import { Card, Page, Layout, BlockStack } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useTranslation, Trans } from "react-i18next";

import { trophyImage } from "../assets";
import { ProductsCard } from "../components";

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <Page narrowWidth>
      <TitleBar title={t("HomePage.title")} />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <a href={`/sunGlassesInvetory.csv`} download="sample.csv">
              Click to download
            </a>
            <BlockStack
              spacing="extraTight"
              distribution="trailing"
              alignment="center"
            >
              Block stack
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <ProductsCard />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
