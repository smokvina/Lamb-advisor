import { Injectable, signal, effect } from '@angular/core';
import { Restaurant } from '../models/chat.model';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private storageKey = 'lambAdvisorFavorites';
  favorites = signal<Restaurant[]>([]);

  constructor() {
    // Load favorites from localStorage on initialization
    const savedFavorites = localStorage.getItem(this.storageKey);
    if (savedFavorites) {
      try {
        this.favorites.set(JSON.parse(savedFavorites));
      } catch (e) {
        console.error("Failed to parse favorites from localStorage", e);
        localStorage.removeItem(this.storageKey);
      }
    }

    // Save favorites to localStorage whenever the signal changes
    effect(() => {
      localStorage.setItem(this.storageKey, JSON.stringify(this.favorites()));
    });
  }

  isFavorite(restaurantName: string): boolean {
    return this.favorites().some(r => r.name === restaurantName);
  }

  toggleFavorite(restaurant: Restaurant): void {
    if (this.isFavorite(restaurant.name)) {
      this.favorites.update(current => current.filter(r => r.name !== restaurant.name));
    } else {
      // Create a clean copy of the restaurant object to avoid potential issues
      const favoriteToAdd: Restaurant = {
        name: restaurant.name,
        rating: restaurant.rating,
        reviewsSnippet: restaurant.reviewsSnippet,
        mapsQuery: restaurant.mapsQuery,
        mapsUrl: restaurant.mapsUrl
      };
      this.favorites.update(current => [...current, favoriteToAdd]);
    }
  }

  getFavorites(): Restaurant[] {
    return this.favorites();
  }
}
