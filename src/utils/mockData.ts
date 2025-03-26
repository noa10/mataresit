
// Sample receipt images - replace with your own assets
const sampleImages = [
  "/placeholder.svg",
  "/placeholder.svg",
  "/placeholder.svg",
  "/placeholder.svg",
  "/placeholder.svg",
  "/placeholder.svg",
];

export interface ReceiptData {
  id: string;
  merchant: string;
  date: string;
  total: number;
  tax?: number;
  currency: string;
  paymentMethod?: string;
  lineItems?: Array<{
    id: string;
    description: string;
    amount: number;
  }>;
  imageUrl: string;
  status: "unreviewed" | "reviewed" | "synced";
  confidence: {
    merchant: number;
    date: number;
    total: number;
    tax?: number;
    lineItems?: number;
  };
  createdAt: string;
}

export const generateMockReceipts = (count = 6): ReceiptData[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `receipt-${i + 1}`,
    merchant: [
      "Starbucks Coffee", 
      "Office Supplies Inc.", 
      "Business Travel Agency", 
      "Downtown Diner",
      "Tech Hardware Store",
      "Airport Taxi Service"
    ][i % 6],
    date: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toLocaleDateString(),
    total: Math.round(Math.random() * 100 * 100) / 100 + 10,
    tax: Math.round(Math.random() * 10 * 100) / 100,
    currency: "USD",
    paymentMethod: ["Credit Card", "Cash", "Debit Card"][Math.floor(Math.random() * 3)],
    lineItems: i % 3 === 0 ? [] : Array.from({ length: Math.floor(Math.random() * 4) + 1 }, (_, j) => ({
      id: `item-${i}-${j}`,
      description: [
        "Coffee & Pastry", 
        "Office Supplies", 
        "Transportation", 
        "Meal", 
        "Electronics",
        "Service Fee"
      ][Math.floor(Math.random() * 6)],
      amount: Math.round(Math.random() * 20 * 100) / 100 + 5,
    })),
    imageUrl: sampleImages[i % sampleImages.length],
    status: ["unreviewed", "reviewed", "synced"][Math.floor(Math.random() * 3)] as "unreviewed" | "reviewed" | "synced",
    confidence: {
      merchant: Math.floor(Math.random() * 30) + 70,
      date: Math.floor(Math.random() * 40) + 60,
      total: Math.floor(Math.random() * 20) + 80,
      tax: Math.floor(Math.random() * 50) + 50,
      lineItems: Math.floor(Math.random() * 40) + 60,
    },
    createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

export const mockReceipts = generateMockReceipts();

export const getReceiptById = (id: string): ReceiptData | undefined => {
  return mockReceipts.find(receipt => receipt.id === id);
};
