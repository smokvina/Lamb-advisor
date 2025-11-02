import { Injectable, signal, effect } from '@angular/core';
import { SearchHistoryItem } from '../models/search-history.model';

@Injectable({
  providedIn: 'root'
})
export class SearchHistoryService {
  private storageKey = 'lambAdvisorHistory';
  private maxHistorySize = 10;
  history = signal<SearchHistoryItem[]>([]);

  constructor() {
    const savedHistory = localStorage.getItem(this.storageKey);
    if (savedHistory) {
      try {
        this.history.set(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse search history from localStorage", e);
        localStorage.removeItem(this.storageKey);
      }
    }

    effect(() => {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history()));
    });
  }

  addSearch(item: SearchHistoryItem): void {
    this.history.update(current => {
      // Remove any existing item with the same location and filters to move it to the top
      const filtered = current.filter(
        h => !(h.location.toLowerCase() === item.location.toLowerCase() &&
               JSON.stringify(h.filters) === JSON.stringify(item.filters))
      );
      
      // Add new item to the front and cap the history size
      const newHistory = [item, ...filtered];
      return newHistory.slice(0, this.maxHistorySize);
    });
  }

  getHistory(): SearchHistoryItem[] {
    return this.history();
  }
}
