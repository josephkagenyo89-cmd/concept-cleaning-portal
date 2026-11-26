export interface CatalogService {
  id: string;
  category: string;
}

export const getPackageServices = <T extends CatalogService>(services: T[]): T[] =>
  services.filter((service) => service.category === "Package");

export const isPackageSelectionValid = (selectedIds: string[], services: CatalogService[]): boolean => {
  if (selectedIds.length === 0) return false;

  const packageIds = new Set(getPackageServices(services).map((service) => service.id));
  return selectedIds.every((id) => packageIds.has(id));
};