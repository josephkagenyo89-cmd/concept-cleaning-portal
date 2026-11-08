const STORAGE_KEY = 'concept-marketplace-behaviour-v1';

type Interaction = {
  category: string;
  categoryViews: number;
  categoryClicks: number;
  serviceViews: number;
  serviceClicks: number;
  lastInteraction: number;
};

type InteractionType =
  | 'category_view'
  | 'category_click'
  | 'service_view'
  | 'service_click';

function readInteractions(): Interaction[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is Interaction =>
        item &&
        typeof item.category === 'string' &&
        typeof item.lastInteraction === 'number'
    );
  } catch {
    return [];
  }
}

function recordInteraction(category: string, type: InteractionType) {
  const name = category.trim();
  if (!name) return;

  try {
    const interactions = readInteractions();
    const existing = interactions.find((item) => item.category === name);

    const entry: Interaction = existing || {
      category: name,
      categoryViews: 0,
      categoryClicks: 0,
      serviceViews: 0,
      serviceClicks: 0,
      lastInteraction: Date.now(),
    };

    if (type === 'category_view') entry.categoryViews += 1;
    if (type === 'category_click') entry.categoryClicks += 1;
    if (type === 'service_view') entry.serviceViews += 1;
    if (type === 'service_click') entry.serviceClicks += 1;

    entry.lastInteraction = Date.now();

    const updated = [
      ...interactions.filter((item) => item.category !== name),
      entry,
    ].slice(-30);

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Tracking is optional; browsing must continue if storage is unavailable.
  }
}

export function trackCategoryView(category: string) {
  recordInteraction(category, 'category_view');
}

export function trackCategoryClick(category: string) {
  recordInteraction(category, 'category_click');
}

export function trackServiceView(category: string) {
  recordInteraction(category, 'service_view');
}

export function trackServiceClick(category: string) {
  recordInteraction(category, 'service_click');
}

export function getRecommendedCategory(categories: string[]): string | null {
  const available = categories.filter(Boolean);
  if (!available.length) return null;

  const interactions = readInteractions().filter((item) =>
    available.includes(item.category)
  );

  if (!interactions.length) {
    return available[Math.floor(Math.random() * available.length)];
  }

  interactions.sort((a, b) => {
    const score = (item: Interaction) =>
      item.categoryClicks * 4 +
      item.serviceClicks * 5 +
      item.serviceViews * 3 +
      item.categoryViews;

    return score(b) - score(a) || b.lastInteraction - a.lastInteraction;
  });

  return interactions[0]?.category ||
    available[Math.floor(Math.random() * available.length)];
}
