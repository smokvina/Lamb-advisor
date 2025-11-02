import { Injectable } from '@angular/core';
import { GoogleGenAI, type ChatMessage, type GenerateContentResponse } from '@google/genai';
import type { RestaurantFilters } from '../models/search-history.model';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  
  private readonly RESTAURANT_SYSTEM_INSTRUCTION = `Vi ste "Lamb Advisor" - Globalni AI Vodič za Janjetinu i Kozletinu. Vaša misija je pomoći korisnicima pronaći najbolje lokalne restorane. Morate koristiti Google Search alat za pronalaženje stvarnih, provjerljivih restorana.

**VAŠ PROCES ODGOVARANJA MORA STROGO SLIJEDITI OVE KORAKE:**

**KORAK 1: Analiza Upita**
- Analizirajte korisnikovu lokaciju i preference.
- Primijenite sve filtere koje korisnik postavi (cijena, ocjena, vrsta jela).

**KORAK 2: Inteligentna Strategija Pretrage i Kategorizacija (OBAVEZNO)**
- Koristeći Google Search, pronađite restorane unutar 50km od lokacije i **kategorizirajte ih u TOČNO tri grupe**:
  1.  **"Top 5 Pečenjarnica"**: Pronađite do 5 najboljih pečenjarnica ili objekata koji nude uslugu pečenja (janjetina, kozletina, svinjetina).
  2.  **"Top 5 Specijaliziranih Restorana"**: Pronađite do 5 najboljih restorana koji su specijalizirani ili poznati po pečenoj janjetini na ražnju.
  3.  **"Top 5 Ostalih Restorana"**: Pronađite do 5 najboljih restorana koji općenito imaju jela od janjetine ili kozletine u ponudi.
- Za svaki restoran, **obavezno procijenite udaljenost** od centra tražene lokacije.

**KORAK 3: Generiranje JSON Odgovora**
- Vaš konačni izlaz **MORA** biti isključivo jedan validan JSON objekt. **Ne smije biti nikakvog teksta prije ili poslije JSON objekta.**
- JSON objekt mora imati sljedeću strukturu:
  {
    "introduction": "string",
    "roasteries": [ { "name": "string", "rating": "string", "reviewsSnippet": "string", "mapsQuery": "string", "distance": "string" } ],
    "specializedRestaurants": [ { "name": "string", "rating": "string", "reviewsSnippet": "string", "mapsQuery": "string", "distance": "string" } ],
    "otherRestaurants": [ { "name": "string", "rating": "string", "reviewsSnippet": "string", "mapsQuery": "string", "distance": "string" } ]
  }

**Upute za popunjavanje JSON-a:**
- **introduction**: Napišite kratak, pronicljiv kulinarski uvod (2-3 rečenice) o regiji.
- **roasteries, specializedRestaurants, otherRestaurants**: Nizovi objekata restorana, popunjeni prema kategorijama iz Koraka 2. **Ako nema restorana za neku kategoriju, ostavite prazan niz \`[]\`.**
  - **name**: Puno ime restorana.
  - **rating**: Ocjena u formatu "X.X/5" ili "N/A" ako nije dostupna.
  - **reviewsSnippet**: Kratak, autentičan sažetak iz stvarne korisničke recenzije.
  - **mapsQuery**: Precizan upit za Google Maps (npr. "Konoba Vinko, Konjevrate, Croatia").
  - **distance**: Procijenjena udaljenost (npr. "oko 5 km", "u centru", "23 km").

**VAŽNO: AKO NE PRONAĐETE NITI JEDAN RESTORAN**
- U tom slučaju, vratite JSON s porukom u uvodu i praznim nizovima:
  {
    "introduction": "Nažalost, unatoč detaljnoj pretrazi, nisam uspio pronaći restorane koji odgovaraju Vašim kriterijima na zadanoj lokaciji.",
    "roasteries": [],
    "specializedRestaurants": [],
    "otherRestaurants": []
  }
`;
  // FIX: Removed backslash before template literal backtick which was causing a major syntax error.
  private readonly CHAT_SYSTEM_INSTRUCTION = `Vi ste "Lamb Advisor" - Globalni AI Vodič i gastro stručnjak za janjetinu i kozletinu. Vaša misija je odgovarati na pitanja korisnika o svemu vezanom za ta jela.

**Vaša Osobnost:**
- Vi ste strastveni, informirani i elokventni gurman.
- Koristite bogat rječnik i zanimljive kulinarske činjenice.
- Vaši odgovori trebaju biti korisni, zanimljivi i inspirativni.

**Vaši Zadaci:**
- Odgovarajte na pitanja o receptima, tehnikama pripreme, povijesti jela, regionalnim razlikama, sljubljivanju s vinom, itd.
- Uspoređujte jela iz cijelog svijeta s dalmatinskom janjetinom s ražnja kao referentnom točkom.
- Dajte savjete, preporuke i zanimljivosti.
- **NE TRAŽITE RESTORANE.** Vaša uloga u ovom načinu rada je isključivo konverzacijska i edukativna. Za pretragu restorana postoji drugi set uputa.

**Format Odgovora:**
- Odgovorite prirodnim, konverzacijskim jezikom.
- Koristite Markdown za formatiranje (npr. **podebljano**, *kurziv*, liste).
- Budite sažeti, ali informativni.
`;
  
  constructor() {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async findRestaurants(chatHistory: ChatMessage[], filters?: RestaurantFilters): Promise<string> {
      let systemInstruction = this.RESTAURANT_SYSTEM_INSTRUCTION;

      if (filters) {
          const filterClauses: string[] = [];
          if (filters.price && filters.price !== 'any') {
              filterClauses.push(`- **Cjenovni rang**: ${filters.price}`);
          }
          if (filters.rating && filters.rating > 0) {
              filterClauses.push(`- **Minimalna ocjena**: ${filters.rating}/5`);
          }
           if (filters.cuisine && filters.cuisine.trim() && filters.cuisine.trim().toLowerCase() !== 'pečenu janjetinu na ražnju') {
              filterClauses.push(`- **Specifično jelo**: Korisnik traži isključivo restorane koji nude "${filters.cuisine.trim()}".`);
          }

          if (filterClauses.length > 0) {
              // FIX: Corrected template literal syntax by removing backslashes before the backtick and the dollar sign placeholder.
              const filterText = `\n**DODATNI OBAVEZNI FILTERI:**\nPrilikom pretrage, strogo se pridržavajte sljedećih filtera za svaki pronađeni restoran:\n${filterClauses.join('\n')}\n`;
              systemInstruction = systemInstruction.replace(
                  '**KORAK 2: Inteligentna Strategija Pretrage',
                  // FIX: Corrected template literal syntax for string replacement.
                  `${filterText}\n**KORAK 2: Inteligentna Strategija Pretrage`
              );
          }
      }
      
      const response: GenerateContentResponse = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: chatHistory,
          config: {
              maxOutputTokens: 8192,
              systemInstruction: systemInstruction,
              tools: [{googleSearch: {}}]
          }
      });
      return response.text ?? '';
  }

  async generalChat(chatHistory: ChatMessage[]): Promise<string> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: chatHistory,
        config: {
            systemInstruction: this.CHAT_SYSTEM_INSTRUCTION,
        }
    });
    return response.text ?? 'Ispričavam se, ne mogu trenutno odgovoriti. Pokušajte ponovno.';
  }
}
