import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Message } from '../../models/chat.model';

interface Restaurant {
  name: string;
  rating: string;
  review: string;
  mapsUrl: string;
}

interface ParsedContent {
  intro: string;
  list: Restaurant[];
  sources: string;
}

@Component({
  selector: 'app-chat-message',
  templateUrl: './chat-message.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class ChatMessageComponent {
  message = input.required<Message>();

  parsedContent = computed<ParsedContent | null>(() => {
    const msg = this.message();
    if (msg.messageType !== 'restaurants' || !msg.text) {
        return null;
    }

    const restaurants: Restaurant[] = [];
    const restaurantRegex = /\*\*(.*?)\*\*\s*\n\*Ocjena:(.*?)\*\s*\n\*MapsQuery:(.*?)\*\s*\n_(.*?)_/gs;
    
    let match;
    let firstMatchIndex = -1;
    while ((match = restaurantRegex.exec(msg.text)) !== null) {
        if (firstMatchIndex === -1) {
            firstMatchIndex = match.index;
        }
        const mapsQuery = match[3].trim();
        restaurants.push({
            name: match[1].trim(),
            rating: match[2].trim(),
            review: match[4].trim(),
            mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
        });
    }
    
    const sourcesMatch = msg.text.match(/\n\n\*\*Izvori:\*\*\n(.+)/s);
    const sources = sourcesMatch ? sourcesMatch[0] : '';
    
    if (restaurants.length > 0) {
        const intro = msg.text.substring(0, firstMatchIndex).trim();
        return {
            intro: this.renderMarkdown(intro),
            list: restaurants,
            sources: this.renderMarkdown(sources)
        };
    }

    return null; // Fallback to simple rendering if parsing fails
  });

  renderMarkdown(text: string): string {
    if (!text) {
      return '';
    }
    // FIX: Enhanced markdown rendering to include links and newlines for better formatting of AI responses and search sources.
    // Replace **text** with <strong>text</strong>
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Replace _text_ with <em>text</em> for reviews
    formattedText = formattedText.replace(/_(.*?)_/g, '<em>$1</em>');
    // Replace *text* with <em>text</em> for ratings
    formattedText = formattedText.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Replace [link text](url) with <a href="url" target="_blank">link text</a>
    formattedText = formattedText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>');
    // Replace newlines with <br>
    formattedText = formattedText.replace(/\n/g, '<br>');
    return formattedText;
  }
}