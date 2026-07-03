// src/data/factsheets.ts
export interface Factsheet {
  id: string;
  title: string;
  abstract: string;
  thumbnail: string;
  pdf: string;
  lastUpdated: string;
}

export const factsheets: Factsheet[] = [
  {
    id: "population-ageing-odisha",
    title: "Population Ageing in Odisha",
    abstract: "Key facts and figures on population ageing in Odisha.",
    thumbnail: "/images/popagefactsheet.png",
    pdf: "/factsheets/Population Ageing in Odisha.pdf",
    lastUpdated: "2025-06-01",
  },
  {
    id: "factsheet-2",
    title: "Transformative Odisha @2036",
    abstract: "Leveraging Demographic Intelligence for Development.",
    thumbnail: "/images/fact1.png",
    pdf: "/reports/transfermative Odisha @2036.pdf",
    lastUpdated: "2025-06-01",
  },
  {
    id: "factsheet-3",
    title: "Demographic Analysis 2024",
    abstract: "Leveraging Demographic Intelligence for Development.",
    thumbnail: "/images/demographic-analysis.png",
    pdf: "/reports/demographic-analysis-2025.pdf",
    lastUpdated: "2025-06-01",
  },
];
