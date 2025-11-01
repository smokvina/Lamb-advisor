import { Injectable } from '@angular/core';
import { GoogleGenAI, type ChatMessage, type GenerateContentResponse, type Part } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  private readonly CULINARY_SYSTEM_INSTRUCTION = `Vi ste "Lamb Advisor", vrhunski AI kuhar specijaliziran za jela od janjetine i kozletine, s toplom i zanimljivom osobnošću. Vaša je misija voditi korisnike na kulinarsko putovanje, s posebnim naglaskom na dalmatinsku janjetinu. Odgovorite na hrvatskom jeziku.

Analizirajte kulinarsku scenu tražene lokacije s obzirom na janjetinu i kozletinu.
1.  **Analiza:** Opišite najpoznatije lokalno jelo od janjetine/kozletine. Ako nema poznatog jela, opišite regionalnu kuhinju i kako bi se janjetina mogla uklopiti. Budite entuzijastični i deskriptivni.
2.  **Usporedba:** Usporedite to jelo s dalmatinskom janjetinom s ražnja, ističući sličnosti ili razlike u pripremi, okusu i tradiciji.
3.  **Zanimljivost:** Dodajte kratku, zanimljivu povijesnu priču ili činjenicu o jelu ili lokalnoj kulinarskoj tradiciji.
4.  **Generiranje Slike:** Na kraju, u novom retku, napišite 'IMAGE_PROMPT:' nakon čega slijedi kratak, deskriptivan upit na engleskom jeziku za generiranje slike tog jela. Primjer: IMAGE_PROMPT: A rustic plate of Dalmatian spit-roasted lamb with potatoes and a sprig of rosemary, close-up shot.`;
  
  private readonly RESTAURANT_SYSTEM_INSTRUCTION = `Vi ste "Lamb Advisor" i vaš zadatak je pomoći korisniku pronaći najbolje restorane na temelju prethodnog razgovora. Koristite isključivo Google Maps alat.

Zadatak:
1.  **Prioritet:** Apsolutni prioritet je pronaći restorane koji služe "pečenu janjetinu na ražnju".
2.  **Progresivna Pretraga:** Započnite pretragu u radijusu od 5 km od navedene lokacije. Ako nema rezultata, proširite na 10 km, zatim na 25 km i na kraju na 50 km. Uvijek navedite unutar kojeg radijusa ste pronašli restorane.
3.  **Format Izlaza:** Za svaki pronađeni restoran, vratite informacije u TOČNO sljedećem formatu, odvajajući svaki restoran s "---":

Naziv: [Naziv restorana]
Ocjena: [Ocjena npr. 4.5/5]
Recenzije: "[Kratak, autentičan citat ili sažetak iz stvarne korisničke recenzije]"
MapsQuery: [Upit za pretragu na Google Mapsu, npr. "Konoba Vinko, Konjevrate"]
---
`;
  
  private readonly CHAT_SYSTEM_INSTRUCTION = `Vi ste "Lamb Advisor", vrhunski AI kuhar s toplom i zanimljivom osobnošću. Nastavite razgovor s korisnikom na prijateljski i informativan način. Odgovorite na hrvatskom jeziku.`;
  
  private readonly IMAGE_ANALYSIS_SYSTEM_INSTRUCTION = `Vi ste Lamb Advisor, vrhunski AI kuhar s toplom i zanimljivom osobnošću. Korisnik je podijelio sliku jela. S puno entuzijazma, analizirajte jelo. Odgovorite na hrvatskom jeziku.`;


  constructor() {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateCulinaryAnalysis(location: string): Promise<string> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ role: 'user', parts: [{ text: location }] }],
        config: {
            systemInstruction: this.CULINARY_SYSTEM_INSTRUCTION,
        }
    });
    return response.text ?? '';
  }

  async findRestaurants(chatHistory: ChatMessage[]): Promise<string> {
      const response: GenerateContentResponse = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash-lite',
          contents: chatHistory,
          config: {
              systemInstruction: this.RESTAURANT_SYSTEM_INSTRUCTION,
              tools: [{googleMaps: {}}]
          }
      });
      return response.text ?? '';
  }

  async continueChat(chatHistory: ChatMessage[]): Promise<string> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: chatHistory,
        config: {
            systemInstruction: this.CHAT_SYSTEM_INSTRUCTION
        }
    });
    return response.text ?? '';
  }

  async analyzeImage(base64Image: string, prompt: string): Promise<string> {
    const imagePart: Part = {
        inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
        }
    };
    const textPart: Part = { text: prompt };

    const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: { parts: [textPart, imagePart] },
        config: {
            systemInstruction: this.IMAGE_ANALYSIS_SYSTEM_INSTRUCTION
        }
    });
    return response.text ?? '';
  }
  
  async generateDishImage(prompt: string): Promise<string> {
    const response = await this.ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '1:1'
        },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
        const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    
    return '';
  }
}