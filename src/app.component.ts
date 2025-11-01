import { Component, ChangeDetectionStrategy, signal, inject, ChangeDetectorRef, viewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';
import { ChatMessage, Message } from './models/chat.model';
import { ChatMessageComponent } from './components/chat-message/chat-message.component';
import { ImageUploadComponent } from './components/image-upload/image-upload.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, ChatMessageComponent, ImageUploadComponent]
})
export class AppComponent {
  private geminiService = inject(GeminiService);
  private cdr = inject(ChangeDetectorRef);

  messages = signal<Message[]>([]);
  userInput = signal('');
  isLoading = signal(false);
  userLocation = signal<string | null>(null);
  
  private conversationStarted = false;
  private chatHistory: ChatMessage[] = [];

  chatContainer = viewChild<ElementRef>('chatContainer');
  messageInput = viewChild<ElementRef>('messageInput');

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
      if (!this.conversationStarted) {
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

  async onImageSelected(base64Image: string): Promise<void> {
    if (this.isLoading()) return;
    
    this.messages.update(current => [...current, {
        id: Date.now(),
        sender: 'user',
        text: 'Što mislite o ovom jelu?',
        imageUrl: `data:image/jpeg;base64,${base64Image}`
    }]);
    this.scrollToBottom();
    
    this.isLoading.set(true);

    try {
        const prompt = "Analizirajte jelo na slici. Ako ga prepoznate, navedite njegovo ime. Opišite njegove vjerojatne sastojke, pripremu i okuse na primamljiv način. Usporedite ga s dalmatinskom janjetinom, bilo izravno (ako je janjetina) ili metaforički (ako je drugo jelo). Obavezno uključite i neku zanimljivu povijesnu priču ili zabavnu činjenicu o tom jelu kako biste oduševili korisnika.";
        const response = await this.geminiService.analyzeImage(base64Image, prompt);
        this.addAiMessage(response);
    } catch(error) {
        console.error('Error analyzing image:', error);
        this.addAiMessage('Žao mi je, nisam uspio analizirati ovu sliku. Molimo pokušajte s drugom.');
    } finally {
        this.isLoading.set(false);
        this.scrollToBottom();
    }
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

      const { latitude, longitude } = position.coords;
      const locationString = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
      
      this.messages.update(current => {
          const lastMessage = current[current.length - 1];
          if (lastMessage.sender === 'user') {
              lastMessage.text = `Lokacija podijeljena: ${locationString}`;
          }
          return [...current];
      });

      await this.handleInitialQuery(locationString);
      this.conversationStarted = true;

    } catch (error: any) {
      let errorMessage = 'Nije moguće dohvatiti lokaciju. Molimo provjerite dozvole u pregledniku.';
      if (error.code === 1) { // PERMISSION_DENIED
        errorMessage = 'Dozvola za pristup lokaciji je odbijena. Molimo omogućite je u postavkama preglednika.';
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        errorMessage = 'Lokacija trenutno nije dostupna. Provjerite mrežnu vezu ili GPS signal.';
      } else if (error.code === 3) { // TIMEOUT
        errorMessage = 'Isteklo je vrijeme za dohvaćanje lokacije. Molimo pokušajte ponovno.';
      }
      this.addAiMessage(errorMessage);
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
      this.scrollToBottom();
    }
  }
  
  async findLocalRestaurants(): Promise<void> {
    if (this.isLoading() || !this.userLocation()) return;

    const userMessage = "Pronađi najbolje restorane u mojoj blizini koji poslužuju lokalne specijalitete o kojima smo pričali.";
    this.addUserMessage(userMessage);
    this.isLoading.set(true);
    this.scrollToBottom();

    this.chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
      const response = await this.geminiService.findRestaurants(this.chatHistory);
      this.addAiMessage(response, 'restaurants');
      this.chatHistory.push({ role: 'model', parts: [{ text: response }] });
    } catch (error) {
      console.error('Error finding restaurants:', error);
      this.addAiMessage('Ispričavam se, došlo je do pogreške pri traženju restorana. Molimo pokušajte ponovno.');
    } finally {
      this.isLoading.set(false);
      this.scrollToBottom();
    }
  }

  private async handleInitialQuery(location: string): Promise<void> {
    this.userLocation.set(location);
    this.chatHistory.push({ role: 'user', parts: [{ text: location }] });
    
    // Steps 1 & 3: Get culinary analysis and restaurants in parallel
    const [analysis, restaurants] = await Promise.all([
      this.geminiService.generateCulinaryAnalysis(location),
      this.geminiService.findRestaurants(this.chatHistory)
    ]);
    
    this.chatHistory.push({ role: 'model', parts: [{ text: analysis }] });
    this.chatHistory.push({ role: 'model', parts: [{ text: restaurants }] });

    const { text: analysisText, imagePrompt } = this.parseAnalysis(analysis);

    // Combine messages for a single response bubble
    const combinedMessage = `${analysisText}\n\n<hr>\n\n### Evo preporuka restorana:\n\n${restaurants}`;

    // Add combined message
    this.addAiMessage(combinedMessage, 'restaurants');
    this.cdr.detectChanges();
    this.scrollToBottom();

    // Step 2: Image Generation (non-blocking)
    if (imagePrompt) {
        this.geminiService.generateDishImage(imagePrompt).then(imageUrl => {
            this.messages.update(current => {
                const lastMessage = current[current.length - 1];
                if (lastMessage && lastMessage.sender === 'ai') {
                    lastMessage.imageUrl = imageUrl;
                }
                return [...current];
            });
            this.cdr.detectChanges();
            this.scrollToBottom();
        }).catch(e => {
            console.error("Image generation failed", e);
        });
    }
  }

  private async handleFollowUpQuery(message: string): Promise<void> {
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });

    let response: string;
    try {
      response = await this.geminiService.continueChat(this.chatHistory);
      this.addAiMessage(response);
      this.chatHistory.push({ role: 'model', parts: [{ text: response }] });
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

  private parseAnalysis(text: string): { text: string, imagePrompt: string | null } {
    const imagePromptMarker = 'IMAGE_PROMPT:';
    const index = text.indexOf(imagePromptMarker);
    if (index !== -1) {
        const mainText = text.substring(0, index).trim();
        const imagePrompt = text.substring(index + imagePromptMarker.length).trim();
        return { text: mainText, imagePrompt };
    }
    return { text, imagePrompt: null };
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