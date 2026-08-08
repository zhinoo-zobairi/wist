export type CatalogueBrand = {
  id: string;
  name: string;
};

export type CatalogueItem = {
  id: string;
  source: "seed" | "awin" | "sandro" | "bobbies";
  sourceProductId: string;
  brandId: string;
  name: string;
  url: string;
  imageUrl: string;
  currentPrice: number;
  previousPrice: number | null;
  currency: string;
  available: boolean;
  observedAt: string;
};
