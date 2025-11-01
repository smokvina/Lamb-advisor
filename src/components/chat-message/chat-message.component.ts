import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Message } from '../../models/chat.model';
import { marked } from 'marked';

interface Restaurant {
  name: string;
  rating: string;
  reviewsSnippet: string;
  mapsQuery: string;
  mapsUrl?: string;
}

@Component({
  selector: 'app-chat-message',
  template: `
    <div class="flex justify-center items-end mb-4">
      <div class="flex flex-col space-y-2 text-base w-full max-w-2xl mx-2">
        <div 
          class="px-4 py-3 rounded-lg inline-block"
          [class.bg-blue-600]="isUser()"
          [class.text-white]="isUser()"
          [class.text-center]="!parsedContent()"
          [class.bg-stone-700]="isAi()"
          [class.text-stone-200]="isAi()">

          @if (parsedContent(); as content) {
            <!-- Structured Restaurant View -->
            <div class="prose prose-sm prose-invert text-left max-w-none">
              <div [innerHTML]="sanitizedHtml()"></div>
              @if (message().imageUrl) {
                <div class="mt-4 flex justify-center">
                  <img [src]="message().imageUrl!" alt="Generated dish" width="300" height="300" class="rounded-lg max-w-full h-auto">
                </div>
              }
            </div>

            <div class="space-y-4 mt-4 text-left">
              @for(restaurant of content.restaurants; track restaurant.name) {
                <div class="p-4 bg-stone-800/70 rounded-lg border border-stone-600 shadow-lg backdrop-blur-sm">
                  <div class="flex justify-between items-start gap-4 mb-2">
                      <h3 class="font-bold text-amber-400 text-lg">{{ restaurant.name }}</h3>
                      @if(restaurant.rating && restaurant.rating !== 'N/A') {
                          <span class="flex-shrink-0 inline-flex items-center gap-1.5 bg-amber-500 text-stone-900 text-sm font-bold px-2.5 py-1 rounded-full">
                              <i class="fa-solid fa-star fa-xs"></i>
                              <span>{{ restaurant.rating.split('/')[0] }}</span>
                          </span>
                      }
                  </div>
                  
                  @if (restaurant.reviewsSnippet && restaurant.reviewsSnippet !== 'Nema recenzija.') {
                    <blockquote class="mt-2 p-3 border-l-4 border-amber-500 bg-stone-700/50 rounded-r-lg">
                      <p class="text-sm italic text-stone-300">"{{ restaurant.reviewsSnippet }}"</p>
                    </blockquote>
                  }
                  
                  @if (restaurant.mapsUrl) {
                    <div class="mt-4 flex items-center justify-start gap-3 flex-wrap">
                      <a [href]="restaurant.mapsUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-md text-sm transition-colors shadow-md">
                        <i class="fa-solid fa-map-location-dot"></i>
                        View on Map
                      </a>
                      <a [href]="restaurant.mapsUrl" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-600 hover:bg-stone-500 text-white rounded-md text-sm transition-colors shadow-md">
                        <i class="fa-solid fa-book-open"></i>
                        Read More
                      </a>
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <!-- Standard Message View -->
            <div class="prose prose-sm max-w-none" [class.prose-invert]="isUser() || isAi()">
              <div [innerHTML]="sanitizedHtml()"></div>
              @if (message().imageUrl) {
                <div class="mt-2 flex justify-center">
                  <img [src]="message().imageUrl!" alt="Uploaded content" width="300" height="300" class="rounded-lg max-w-full h-auto">
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule],
})
export class ChatMessageComponent {
  message = input.required<Message>();
  private sanitizer = inject(DomSanitizer);

  isUser = computed(() => this.message().sender === 'user');
  isAi = computed(() => this.message().sender === 'ai');

  parsedContent = computed(() => {
    const msg = this.message();
    if (msg.sender === 'ai' && msg.messageType === 'restaurants') {
      const parts = msg.text.split('<hr>');
      const introduction = parts[0] ? parts[0].trim() : '';
      const restaurantText = parts[1] ? parts[1].trim() : '';
      
      const restaurantBlocks = restaurantText.replace(/### Evo preporuka restorana:/g, '').trim().split('---').filter(block => block.trim());
      
      const restaurants: Restaurant[] = restaurantBlocks.map(block => {
        const nameMatch = block.match(/Naziv:\s*(.*)/);
        const ratingMatch = block.match(/Ocjena:\s*(.*)/);
        const reviewsMatch = block.match(/Recenzije:\s*"(.*?)"/s);
        const mapsQueryMatch = block.match(/MapsQuery:\s*(.*)/);

        const mapsQuery = mapsQueryMatch ? mapsQueryMatch[1].trim() : '';
        const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : undefined;

        return {
          name: nameMatch ? nameMatch[1].trim() : 'N/A',
          rating: ratingMatch ? ratingMatch[1].trim() : 'N/A',
          reviewsSnippet: reviewsMatch ? reviewsMatch[1].trim() : 'Nema recenzija.',
          mapsQuery: mapsQuery,
          mapsUrl: mapsUrl,
        };
      });

      return {
        introduction,
        restaurants
      };
    }
    return null;
  });

  sanitizedHtml = computed<SafeHtml>(() => {
    const content = this.parsedContent();
    let rawText = this.message().text;

    if (content) {
      rawText = content.introduction;
    }
    
    try {
        const html = marked.parse(rawText);
        return this.sanitizer.bypassSecurityTrustHtml(html as string);
    } catch(e) {
        console.error("Error parsing markdown", e);
        const escapedText = this.escapeHtml(rawText).replace(/\n/g, '<br>');
        return this.sanitizer.bypassSecurityTrustHtml(escapedText);
    }
  });
  
  private escapeHtml(unsafe: string): string {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }
}