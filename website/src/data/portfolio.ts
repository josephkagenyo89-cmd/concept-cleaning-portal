export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  beforeImage: string;
  afterImage: string;
  date: string;
}

export const samplePortfolio: PortfolioItem[] = [
  {
    id: "1",
    title: "Living Room Deep Clean",
    description: "Complete living room transformation including carpet shampooing and furniture cleaning.",
    category: "Deep Cleaning",
    beforeImage: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600",
    afterImage: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600",
    date: "2026-03-28",
  },
  {
    id: "2",
    title: "SUV Full Detailing",
    description: "Interior and exterior detailing of a Toyota Prado. Full paint correction and ceramic coating.",
    category: "Car Detailing",
    beforeImage: "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600",
    afterImage: "https://images.unsplash.com/photo-1542362567-b07e54358753?w=600",
    date: "2026-03-25",
  },
  {
    id: "3",
    title: "Office Carpet Restoration",
    description: "Commercial carpet cleaning for a busy office space. Removed years of dirt and stains.",
    category: "Carpet & Sofa Cleaning",
    beforeImage: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600",
    afterImage: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=600",
    date: "2026-03-20",
  },
  {
    id: "4",
    title: "Driveway Cabro Cleaning",
    description: "High-pressure cleaning of paving blocks. Restored to original color and sealed.",
    category: "Cabro Cleaning",
    beforeImage: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600",
    afterImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600",
    date: "2026-03-15",
  },
];
