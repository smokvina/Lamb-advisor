export interface Message {
    id: number;
    sender: 'user' | 'ai';
    text: string;
    imageUrl?: string;
    // We could add more properties here for things like restaurant lists
}

// Re-exporting from @google/genai for convenience in services
export type { ChatMessage } from '@google/genai';
