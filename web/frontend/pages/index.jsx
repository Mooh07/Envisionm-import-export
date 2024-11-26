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
        <Layout.Section></Layout.Section>
        <Layout.Section>
          <ProductsCard />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
