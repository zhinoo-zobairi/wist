export type Brand = {
  id: string;
  name: string;
  monogram: string;
  curated: true;
};

export type Item = {
  id: string;
  brandId: string;
  name: string;
  imageUrl: string;
  currentPrice: number;
  currency: "EUR";
  url: string;
};

export type PriceSnapshot = {
  id: string;
  itemId: string;
  price: number;
  capturedAt: string;
};

export type User = {
  id: string;
};

export type Follow = {
  userId: string;
  brandId: string;
};

export type Star = {
  userId: string;
  itemId: string;
};

export type Alert = {
  id: string;
  userId: string;
  itemId: string;
  oldPrice: number;
  newPrice: number;
  pctOff: number;
  createdAt: string;
  read: boolean;
};

export const LOCAL_USER_ID = "local-user";
