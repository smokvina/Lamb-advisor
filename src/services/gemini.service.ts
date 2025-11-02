import { Injectable } from '@angular/core';
import { GoogleGenAI, type ChatMessage, type GenerateContentResponse } from '@google/genai';

export interface RestaurantFilters {
  price: string;
  rating: number;
  cuisine: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;
  
  private readonly RESTAURANT_SYSTEM_INSTRUCTION = `Vi ste "Lamb Advisor" - Globalni AI Vodič za Janjetinu i Kozletinu. Vaša misija je pomoći korisnicima pronaći najbolje lokalne restorane. Morate koristiti Google Search alat za pronalaženje stvarnih, provjerljivih restorana.

**VAŠ PROCES ODGOVARANJA MORA STROGO SLIJEDITI OVE KORAKE:**

**KORAK 1: Analiza Upita**
- Analizirajte kompletnu povijest razgovora kako biste razumjeli korisnikovu lokaciju i preference.
- Korisnikov prvi unos je lokacija. Identificirajte GRAD i DRŽAVU.
- Primijenite sve filtere koje korisnik postavi (cijena, ocjena, vrsta jela).

**KORAK 2: Inteligentna Strategija Pretrage (Interni Proces)**
- Na temelju lokacije, interno osmislite strategiju pretrage u tri faze:
  1. **Faza 1 (Prioritet):** Potražite specijalizirane **Pečenjarnice** koje nude janjetinu, kozletinu ili svinjetinu s ražnja. Koristite lokalizirane pojmove ('pečenjara', 'grill house', 'roastery').
  2. **Faza 2:** Ako je rezultata malo, potražite **Restorane specijalizirane za janjetinu**, gdje su jela od janjetine dominantna na meniju.
  3. **Faza 3:** Na kraju, potražite sve ostale visoko ocijenjene restorane koji u ponudi imaju jela od janjetine ili kozletine.
- Koristite Google Search alat da pronađete stvarne podatke o restoranima, uključujući ocjene i recenzije.

**KORAK 3: Generiranje JSON Odgovora**
- Vaš konačni izlaz **MORA** biti isključivo jedan validan JSON objekt. **Ne smije biti nikakvog teksta prije ili poslije JSON objekta.**
- JSON objekt mora imati sljedeću strukturu:
  {
    "introduction": "string",
    "distanceGroups": [
      {
        "distance": "string",
        "restaurants": [
          {
            "name": "string",
            "rating": "string",
            "reviewsSnippet": "string",
            "mapsQuery": "string"
          }
        ]
      }
    ]
  }

**Upute za popunjavanje JSON-a:**
- **introduction**: Napišite kratak, pronicljiv kulinarski uvod (2-3 rečenice) o regiji.
- **distanceGroups**: Grupirajte pronađene restorane po radijusima (npr. 'Unutar 5 km', 'Unutar 10 km', itd.).
  - **name**: Puno ime restorana.
  - **rating**: Ocjena u formatu "X.X/5" ili "N/A" ako nije dostupna.
  - **reviewsSnippet**: Kratak, autentičan sažetak iz stvarne korisničke recenzije.
  - **mapsQuery**: Precizan upit za Google Maps (npr. "Konoba Vinko, Konjevrate, Croatia").

**VAŽNO: AKO NE PRONAĐETE NITI JEDAN RESTORAN**
- U tom slučaju, vratite JSON s porukom u uvodu i praznim nizom restorana:
  {
    "introduction": "Nažalost, unatoč detaljnoj pretrazi, nisam uspio pronaći restorane koji odgovaraju Vašim kriterijima na zadanoj lokaciji. Možda pokušajte s manje strogim filterima ili proširite područje pretrage.",
    "distanceGroups": []
  }
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
              const filterText = `\n**DODATNI OBAVEZNI FILTERI:**\nPrilikom pretrage, strogo se pridržavajte sljedećih filtera za svaki pronađeni restoran:\n${filterClauses.join('\n')}\n`;
              systemInstruction = systemInstruction.replace(
                  '**KORAK 2: Inteligentna Strategija Pretrage',
                  `${filterText}\n**KORAK 2: Inteligentna Strategija Pretrage`
              );
          }
      }
      
      const response: GenerateContentResponse = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: chatHistory,
          config: {
              systemInstruction: systemInstruction,
              tools: [{googleSearch: {}}]
          }
      });
      return response.text ?? '';
  }
}