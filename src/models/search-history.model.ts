export interface RestaurantFilters {
  price: string;
  rating: number;
  cuisine: string;
}

export interface SearchHistoryItem {
  id: number; // timestamp
  location: string;
  filters: RestaurantFilters;
}
