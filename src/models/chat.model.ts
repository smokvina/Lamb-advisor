import { SearchHistoryItem } from './search-history.model';

export interface Message {
    id: number;
    sender: 'user' | 'ai';
    text: string;
    messageType?: 'text' | 'restaurants' | 'history';
    historyItems?: SearchHistoryItem[];
}

export interface Restaurant {
  name: string;
  rating: string;
  reviewsSnippet: string;
  mapsQuery: string;
  mapsUrl?: string;
  distance?: string;
}

// Re-exporting from @google/genai for convenience in services
export type { ChatMessage } from '@google/genai';
