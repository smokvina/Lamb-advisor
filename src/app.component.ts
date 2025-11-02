import { Component, ChangeDetectionStrategy, signal, inject, ChangeDetectorRef, viewChild, ElementRef, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeminiService, type RestaurantFilters } from './services/gemini.service';
import { ChatMessage, Message } from './models/chat.model';
import { ChatMessageComponent } from './components/chat-message/chat-message.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, ChatMessageComponent]
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private cdr = inject(ChangeDetectorRef);

  messages = signal<Message[]>([]);
  userInput = signal('');
  isLoading = signal(false);
  userLocation = signal<string | null>(null);
  awaitingLocationConfirmation = signal(false);
  private confirmedLocation = signal<string | null>(null);
  
  showFilters = signal(false);
  priceRange = signal('any');
  minRating = signal(0);
  cuisineType = signal('pečenu janjetinu na ražnju');

  readonly priceOptions = [
    { label: '$', value: '$' },
    { label: '$$', value: '$$' },
    { label: '$$$', value: '$$$' },
    { label: 'Sve', value: 'any' },
  ];
  readonly ratingOptions = [
    { label: '4.5★+', value: 4.5 },
    { label: '4★+', value: 4 },
    { label: '3★+', value: 3 },
    { label: 'Sve', value: 0 },
  ];
  
  private conversationStarted = false;
  private chatHistory: ChatMessage[] = [];

  chatContainer = viewChild<ElementRef>('chatContainer');
  messageInput = viewChild<ElementRef>('messageInput');

  placeholderText = computed(() => {
    if (this.awaitingLocationConfirmation()) {
      return 'Upišite "da" ili ispravnu lokaciju...';
    }
    return 'Upišite Grad/Država da Vam pronađemo Janjetinu.';
  });

  constructor() {
    this.messages.set([{
      id: Date.now(),
      sender: 'ai',
      text: "Dobrodošli u Lamb Advisor! Ja sam vaš osobni AI gurman, spreman u Vašoj okolici prije svega pronaći Pečenu janjetinu na ražnju pa nakon toga istražiti najbolja svjetska jela od janjetine i kozletine. Da bismo započeli naše kulinarsko putovanje, molim vas, recite mi svoju trenutnu lokaciju."
    }]);
  }

  async sendMessage(): Promise<void> {
    const userMessage = this.userInput().trim();
    if (!userMessage || this.isLoading()) return;

    this.addUserMessage(userMessage);
    const capturedMessage = userMessage;
    this.userInput.set('');
    this.isLoading.set(true);
    this.scrollToBottom();

    try {
      if (this.awaitingLocationConfirmation()) {
        this.awaitingLocationConfirmation.set(false);
        let locationToSearch = '';
        
        if (capturedMessage.toLowerCase() === 'da' || capturedMessage.toLowerCase() === 'yes') {
            locationToSearch = this.confirmedLocation()!;
        } else {
            locationToSearch = capturedMessage; 
        }

        this.messages.update(current => {
            const lastMessage = current[current.length - 1];
            if (lastMessage.sender === 'user') {
                lastMessage.text = locationToSearch;
            }
            return [...current];
        });

        await this.handleInitialQuery(locationToSearch);
        this.conversationStarted = true;

      } else if (!this.conversationStarted) {
        await this.handleInitialQuery(capturedMessage);
        this.conversationStarted = true;
      } else {
        await this.handleFollowUpQuery(capturedMessage);
      }
    } catch (error) {
      console.error('Error communicating with Gemini:', error);
      this.addAiMessage('Ispričavam se, ali čini se da imam problema s povezivanjem sa svojom kulinarskom bazom znanja. Molimo pokušajte ponovno za trenutak.');
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
      this.messageInput()?.nativeElement.focus();
      this.scrollToBottom();
    }
  }
  
  onUserInput(event: Event): void {
    this.userInput.set((event.target as HTMLInputElement).value);
  }

  async shareLocation(): Promise<void> {
    if (this.isLoading()) return;
    if (!navigator.geolocation) {
      this.addAiMessage('Vaš preglednik ne podržava geolokaciju.');
      return;
    }

    this.isLoading.set(true);
    this.addUserMessage('Dijeljenje lokacije...');
    this.scrollToBottom();

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      this.messages.update(current => {
          const lastMessage = current[current.length - 1];
          if (lastMessage.sender === 'user') {
              lastMessage.text = 'Lokacija podijeljena. Pronalazim ime mjesta...';
          }
          return [...current];
      });
      this.cdr.detectChanges();

      const { latitude, longitude } = position.coords;
      const geoResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
      if (!geoResponse.ok) throw new Error('Reverse geocoding request failed.');
      
      const geoData = await geoResponse.json();
      const locationName = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county || 'nepoznata lokacija';

      this.confirmedLocation.set(locationName);
      this.awaitingLocationConfirmation.set(true);

      const confirmationMessage = `Čini se da se nalazite u mjestu: **${locationName}**. Je li to točno?\n\nUpišite "da" za potvrdu ili unesite ispravnu lokaciju.`;
      this.addAiMessage(confirmationMessage);
      this.userInput.set('');

    } catch (error: any) {
      this.messages.update(current => {
          const lastMessage = current[current.length - 1];
          if (lastMessage.sender === 'user') {
              lastMessage.text = 'Neuspješno dijeljenje lokacije.';
          }
          return [...current];
      });

      let errorMessage = 'Nije moguće dohvatiti lokaciju. Molimo provjerite dozvole u pregledniku.';
      if (error.code === 1) { // PERMISSION_DENIED
        errorMessage = 'Dozvola za pristup lokaciji je odbijena. Molimo omogućite je u postavkama preglednika.';
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        errorMessage = 'Lokacija trenutno nije dostupna. Provjerite mrežnu vezu ili GPS signal.';
      } else if (error.code === 3) { // TIMEOUT
        errorMessage = 'Isteklo je vrijeme za dohvaćanje lokacije. Molimo pokušajte ponovno.';
      } else if (error.message) {
        errorMessage = `Došlo je do pogreške pri određivanju lokacije: ${error.message}`;
      }
      this.addAiMessage(errorMessage);
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
      this.scrollToBottom();
    }
  }

  toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  setPriceRange(price: string): void {
    this.priceRange.set(price);
  }

  setMinRating(rating: number): void {
    this.minRating.set(rating);
  }

  onCuisineInput(event: Event): void {
    this.cuisineType.set((event.target as HTMLInputElement).value);
  }

  private async handleInitialQuery(location: string): Promise<void> {
    this.userLocation.set(location);
    this.chatHistory.push({ role: 'user', parts: [{ text: location }] });
    
    const filters: RestaurantFilters = {
      price: this.priceRange(),
      rating: this.minRating(),
      cuisine: this.cuisineType(),
    };
    
    const restaurants = await this.geminiService.findRestaurants(this.chatHistory, filters);
    
    this.chatHistory.push({ role: 'model', parts: [{ text: restaurants }] });

    this.addAiMessage(restaurants, 'restaurants');
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  private async handleFollowUpQuery(message: string): Promise<void> {
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });

    const filters: RestaurantFilters = {
      price: this.priceRange(),
      rating: this.minRating(),
      cuisine: this.cuisineType(),
    };

    try {
      const restaurants = await this.geminiService.findRestaurants(this.chatHistory, filters);
      this.addAiMessage(restaurants, 'restaurants');
      this.chatHistory.push({ role: 'model', parts: [{ text: restaurants }] });
    } catch (error) {
      console.error('Error in follow-up query:', error);
      this.addAiMessage('Ispričavam se, naišao sam na problem prilikom obrade vašeg zahtjeva. Molimo pokušajte ponovno.');
    }
  }

  private addUserMessage(text: string): void {
    this.messages.update(current => [...current, { id: Date.now(), sender: 'user', text }]);
  }

  private addAiMessage(text: string, messageType: 'text' | 'restaurants' = 'text'): void {
    const messageText = text ?? '';
    this.messages.update(current => [...current, { id: Date.now(), sender: 'ai', text: messageText, messageType }]);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        if(this.chatContainer()){
          this.chatContainer()!.nativeElement.scrollTop = this.chatContainer()!.nativeElement.scrollHeight;
        }
      } catch (err) { }
    }, 0);
  }
}