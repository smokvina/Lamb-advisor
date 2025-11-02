import { Component, ChangeDetectionStrategy, input, computed, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Message, Restaurant } from '../../models/chat.model';
import { marked } from 'marked';
import { FavoritesService } from '../../services/favorites.service';
import { SearchHistoryItem } from '../../models/search-history.model';

interface ParsedContent {
  introduction: string;
  categories: { title: string; restaurants: Restaurant[] }[];
}

@Component({
  selector: 'app-chat-message',
  template: `
    <div class="flex items-end mb-4" [class.justify-start]="isAi()" [class.justify-end]="isUser()">
      <div class="flex flex-col space-y-2 text-base w-full max-w-2xl mx-2">
        <div 
          class="px-4 py-3 rounded-lg inline-block break-words"
          [class.bg-blue-600]="isUser()"
          [class.text-white]="isUser()"
          [class.self-end]="isUser()"
          [class.bg-stone-700]="isAi()"
          [class.text-stone-200]="isAi()"
          [class.self-start]="isAi()">

          @if (message().messageType === 'history' && message().historyItems) {
            <!-- History View -->
            <div class="space-y-3">
              <h2 class="text-xl font-bold text-amber-400/90 mb-3">Povijest Pretraga</h2>
              @for(item of message().historyItems; track item.id) {
                <div class="p-3 bg-stone-800/70 rounded-lg border border-stone-600">
                  <p class="font-semibold text-stone-200">{{ item.location }}</p>
                  <div class="text-xs text-stone-400 mt-1">
                    <span>{{ item.filters.cuisine }}</span>
                    @if (item.filters.price !== 'any') {
                      <span> • Cijena: {{ item.filters.price }}</span>
                    }
                    @if (item.filters.rating > 0) {
                      <span> • Ocjena: {{ item.filters.rating }}★+</span>
                    }
                  </div>
                  <button (click)="rerunSearch.emit(item)" class="mt-3 text-sm bg-amber-600 hover:bg-amber-700 text-white font-bold py-1 px-3 rounded-md transition-colors">
                    Ponovi
                  </button>
                </div>
              }
            </div>
          } @else if (parsedContent(); as content) {
            <!-- Structured Restaurant View -->
            <div class="prose prose-sm prose-invert text-left max-w-none">
              <div [innerHTML]="sanitizedHtml()"></div>
            </div>

            <div class="space-y-6 mt-4 text-left">
              @for(category of content.categories; track category.title; let isFirst = $first) {
                @if (category.restaurants.length > 0) {
                  <div>
                    @if(!isFirst && visibleCategoryCount() > 1) {
                      <hr class="border-stone-600 my-6">
                    }
                    <h2 class="text-xl font-bold text-amber-400/90 mb-4">{{ category.title }}</h2>
                    <div class="space-y-4">
                      @for(restaurant of category.restaurants; track restaurant.name) {
                        <div class="p-4 bg-stone-800/70 rounded-lg border border-stone-600 shadow-lg backdrop-blur-sm">
                          <div class="flex justify-between items-start gap-3 mb-2">
                            <div class="flex-1">
                                <h3 class="font-bold text-amber-400 text-lg break-words">{{ restaurant.name }}</h3>
                                @if (restaurant.distance) {
                                    <p class="text-sm text-stone-400"><i class="fa-solid fa-road fa-xs mr-1.5"></i>{{ restaurant.distance }}</p>
                                }
                            </div>
                            <div class="flex items-center gap-3">
                                @if(restaurant.rating && restaurant.rating !== 'N/A') {
                                    <span class="flex-shrink-0 inline-flex items-center gap-1.5 bg-amber-500 text-stone-900 text-sm font-bold px-2.5 py-1 rounded-full">
                                        <i class="fa-solid fa-star fa-xs"></i>
                                        <span>{{ restaurant.rating.split('/')[0] }}</span>
                                    </span>
                                }
                                <button
                                    (click)="favoritesService.toggleFavorite(restaurant)"
                                    type="button"
                                    [title]="favoritesService.isFavorite(restaurant.name) ? 'Ukloni iz favorita' : 'Dodaj u favorite'"
                                    class="text-amber-400 hover:text-amber-300 transition-colors text-2xl h-8 w-8 flex items-center justify-center rounded-full hover:bg-white/10">
                                    <i class="fa-star" [class.fa-solid]="favoritesService.isFavorite(restaurant.name)" [class.fa-regular]="!favoritesService.isFavorite(restaurant.name)"></i>
                                </button>
                            </div>
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
                                Prikaži na karti
                              </a>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          } @else {
            <!-- Standard Message View -->
            <div class="prose prose-sm max-w-none" [class.prose-invert]="isUser() || isAi()">
              <div [innerHTML]="sanitizedHtml()"></div>
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
  @Output() rerunSearch = new EventEmitter<SearchHistoryItem>();
  
  private sanitizer = inject(DomSanitizer);
  favoritesService = inject(FavoritesService);

  isUser = computed(() => this.message().sender === 'user');
  isAi = computed(() => this.message().sender === 'ai');

  parsedContent = computed<ParsedContent | null>(() => {
    const msg = this.message();
    if (msg.sender !== 'ai' || msg.messageType !== 'restaurants') {
      return null;
    }

    try {
      const text = msg.text;
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) throw new Error("JSON object not found");
      
      const jsonString = text.substring(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonString);

      const mapRestaurant = (r: any): Restaurant => {
          const mapsQuery = r.mapsQuery || '';
          return {
            name: r.name || 'N/A',
            rating: r.rating || 'N/A',
            reviewsSnippet: r.reviewsSnippet || 'Nema recenzija.',
            mapsQuery: mapsQuery,
            mapsUrl: mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}` : undefined,
            distance: r.distance || undefined,
          };
      };

      const categories = [
        { title: 'Top 5 Pečenjarnica', restaurants: (data.roasteries || []).map(mapRestaurant) },
        { title: 'Top 5 Specijaliziranih Restorana', restaurants: (data.specializedRestaurants || []).map(mapRestaurant) },
        { title: 'Top 5 Ostalih Restorana', restaurants: (data.otherRestaurants || []).map(mapRestaurant) },
      ];
      
      return {
        introduction: data.introduction || '',
        categories: categories
      };

    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e, msg.text);
      return {
        introduction: "Došlo je do pogreške pri obradi odgovora. AI je vratio neočekivani format. Molimo pokušajte s malo drugačijim upitom.",
        categories: []
      };
    }
  });

  visibleCategoryCount = computed<number>(() => {
    const content = this.parsedContent();
    if (!content) {
      return 0;
    }
    return content.categories.filter(c => c.restaurants.length > 0).length;
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