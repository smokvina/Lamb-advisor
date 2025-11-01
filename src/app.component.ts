import { Component, ChangeDetectionStrategy, signal, inject, AfterViewChecked, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
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
  imports: [CommonModule, FormsModule, ChatMessageComponent, ImageUploadComponent]
})
export class AppComponent implements AfterViewChecked {
  private geminiService = inject(GeminiService);
  private cdr = inject(ChangeDetectorRef);

  messages = signal<Message[]>([]);
  userInput = '';
  isLoading = signal(false);
  userLocation = signal<string | null>(null);
  
  private conversationStarted = false;
  private chatHistory: ChatMessage[] = [];

  @ViewChild('chatContainer') private chatContainer!: ElementRef;
  @ViewChild('messageInput') private messageInput!: ElementRef;

  constructor() {
    this.messages.set([{
      id: Date.now(),
      sender: 'ai',
      text: "Dobrodošli u Lamb Advisor! Ja sam vaš osobni AI gurman, spreman istražiti najbolja svjetska jela od janjetine i kozletine. Da bismo započeli naše kulinarsko putovanje, molim vas, recite mi svoju trenutnu lokaciju."
    }]);
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  async sendMessage(): Promise<void> {
    const userMessage = this.userInput.trim();
    if (!userMessage || this.isLoading()) return;

    this.addUserMessage(userMessage);
    const capturedMessage = userMessage;
    this.userInput = '';
    this.isLoading.set(true);

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
      this.messageInput.nativeElement.focus();
    }
  }

  async onImageSelected(base64Image: string): Promise<void> {
    if (this.isLoading()) return;
    
    this.messages.update(current => [...current, {
        id: Date.now(),
        sender: 'user',
        text: 'Što mislite o ovom jelu?',
        imageUrl: `data:image/jpeg;base64,${base64Image}`
    }]);
    
    this.isLoading.set(true);

    try {
        const prompt = "Vi ste Lamb Advisor, vrhunski AI kuhar s toplom i zanimljivom osobnošću. Korisnik je podijelio sliku jela. S puno entuzijazma, analizirajte jelo. Ako ga prepoznate, navedite njegovo ime. Opišite njegove vjerojatne sastojke, pripremu i okuse na primamljiv način. Usporedite ga s dalmatinskom janjetinom, bilo izravno (ako je janjetina) ili metaforički (ako je drugo jelo). Obavezno uključite i neku zanimljivu povijesnu priču ili zabavnu činjenicu o tom jelu kako biste oduševili korisnika. Vaš odgovor mora biti na hrvatskom jeziku.";
        const response = await this.geminiService.analyzeImage(base64Image, prompt);
        this.addAiMessage(response);
    } catch(error) {
        console.error('Error analyzing image:', error);
        this.addAiMessage('Žao mi je, nisam uspio analizirati ovu sliku. Molimo pokušajte s drugom.');
    } finally {
        this.isLoading.set(false);
    }
  }
  
  async findLocalRestaurants(): Promise<void> {
    if (this.isLoading() || !this.userLocation()) return;

    const userMessage = "Pronađi najbolje restorane u mojoj blizini koji poslužuju lokalne specijalitete o kojima smo pričali.";
    this.addUserMessage(userMessage);
    this.isLoading.set(true);
    this.cdr.detectChanges();

    this.chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

    try {
      const response = await this.geminiService.findRestaurants(this.chatHistory);
      this.addAiMessage(response);
      this.chatHistory.push({ role: 'model', parts: [{ text: response }] });
    } catch (error) {
      console.error('Error finding restaurants:', error);
      this.addAiMessage('Ispričavam se, došlo je do pogreške pri traženju restorana. Molimo pokušajte ponovno.');
    } finally {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  private async handleInitialQuery(location: string): Promise<void> {
    this.userLocation.set(location);
    this.chatHistory.push({ role: 'user', parts: [{ text: location }] });
    
    // --- Step 1: Culinary Analysis ---
    const analysis = await this.geminiService.generateCulinaryAnalysis(location);
    const { text, imagePrompt } = this.parseAnalysis(analysis);

    this.addAiMessage(text);
    this.chatHistory.push({ role: 'model', parts: [{ text: analysis }] });
    
    // --- Step 2: Image Generation (non-blocking) ---
    if (imagePrompt) {
        // This will run in the background and update the message when done.
        this.geminiService.generateDishImage(imagePrompt).then(imageUrl => {
            this.messages.update(current => {
                const analysisMessage = current.find(m => m.text === text);
                if (analysisMessage) {
                    analysisMessage.imageUrl = imageUrl;
                }
                return [...current];
            });
            this.cdr.detectChanges();
        }).catch(e => {
            console.error("Image generation failed", e);
            // Optionally add a message about image failure
        });
    }

    // --- Step 3: Find Restaurants (blocking) ---
    try {
        const restaurantResponse = await this.geminiService.findRestaurants(this.chatHistory);
        this.addAiMessage(restaurantResponse);
        this.chatHistory.push({ role: 'model', parts: [{ text: restaurantResponse }] });
    } catch (error) {
        console.error('Error finding restaurants during initial query:', error);
        this.addAiMessage('Ispričavam se, došlo je do pogreške pri traženju restorana. Možete pokušati ponovno koristeći gumb za restorane.');
    }
  }

  private async handleFollowUpQuery(message: string): Promise<void> {
    this.chatHistory.push({ role: 'user', parts: [{ text: message }] });

    // Simple intent detection for finding restaurants
    const isRestaurantQuery = ['restoran', 'pronađi', 'nađi', 'gdje', 'pokaži', 'da', 'molim'].some(keyword => message.toLowerCase().includes(keyword));

    let response: string;
    try {
      if (isRestaurantQuery && this.userLocation()) {
        response = await this.geminiService.findRestaurants(this.chatHistory);
      } else {
        response = await this.geminiService.continueChat(this.chatHistory);
      }
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

  private addAiMessage(text: string): void {
    this.messages.update(current => [...current, { id: Date.now(), sender: 'ai', text }]);
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
    try {
      this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }
}