export interface Message {
    id: number;
    sender: 'user' | 'ai';
    text: string;
    messageType?: 'text' | 'restaurants';
}

// Re-exporting from @google/genai for convenience in services
export type { ChatMessage } from '@google/genai';