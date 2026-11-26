export interface Service {
  id: string;
  title: string;
  description: string;
  startingPrice: number;
  category: string;
  icon: string;
}

export const services: Service[] = [
  {
    id: "home-cleaning",
    title: "Home Cleaning",
    description: "Regular home cleaning to keep your space spotless. We handle dusting, mopping, sanitizing surfaces, and organizing every room.",
    startingPrice: 3000,
    category: "Home Cleaning",
    icon: "Home",
  },
  {
    id: "deep-cleaning",
    title: "Deep Cleaning",
    description: "Intensive deep cleaning that reaches every corner. Perfect for move-in/move-out or seasonal refreshes.",
    startingPrice: 8000,
    category: "Deep Cleaning",
    icon: "Sparkles",
  },
  {
    id: "carpet-sofa",
    title: "Carpet & Sofa Cleaning",
    description: "Professional carpet and upholstery cleaning using industry-grade equipment. Removes stains, allergens, and odors.",
    startingPrice: 4000,
    category: "Carpet & Sofa Cleaning",
    icon: "Armchair",
  },
  {
    id: "car-detailing",
    title: "Car Detailing",
    description: "Complete interior and exterior car detailing. From wash and wax to full interior restoration.",
    startingPrice: 5000,
    category: "Car Detailing",
    icon: "Car",
  },
  {
    id: "cabro-cleaning",
    title: "Cabro Cleaning",
    description: "Restore your paving blocks to their original glory. High-pressure cleaning that removes dirt, moss, and stains.",
    startingPrice: 6000,
    category: "Cabro Cleaning",
    icon: "LayoutGrid",
  },
  {
    id: "wall-algae",
    title: "Wall & Algae Cleaning",
    description: "Professional wall cleaning and algae removal. We restore walls to a clean, fresh appearance.",
    startingPrice: 5000,
    category: "Wall & Algae Cleaning",
    icon: "PaintBucket",
  },
  {
    id: "fumigation",
    title: "Fumigation",
    description: "Safe and effective pest control fumigation for homes and offices. Eliminates insects and rodents.",
    startingPrice: 4000,
    category: "Fumigation",
    icon: "Bug",
  },
];

export const serviceCategories = services.map((s) => s.category);
