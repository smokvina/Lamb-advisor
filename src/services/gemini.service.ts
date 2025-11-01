import { Injectable } from '@angular/core';
import { GoogleGenAI, ChatMessage } from '@google/genai';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  // FIX: Initialize the GoogleGenAI client with the API key from environment variables.
  private ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

  async generateCulinaryAnalysis(location: string): Promise<string> {
    const prompt = `Ti si Lamb Advisor, vrhunski AI kuhar s toplom, zanimljivom i pomalo pjesničkom osobnošću. Tvoja misija je voditi korisnike na kulinarsko putovanje. Tvoj ton je uvijek topao, prijateljski i pun strasti prema hrani. Oduševi korisnika svojim znanjem i pričama!

Korisnik se nalazi u: ${location}.

Tvoj zadatak:
1.  **Analiziraj lokaciju:** Tvoj **apsolutni i najvažniji prioritet** je pronaći jelo od **pečene janjetine na ražnju**. Ako to nije izražena tradicija, onda potraži drugo autentično lokalno jelo od **janjetine ili kozletine**. Tek ako, i samo ako, nakon temeljite analize utvrdiš da takva tradicija zaista ne postoji na zadanoj lokaciji, tek tada se prebaci na najvažniji lokalni obiteljski mesni specijalitet i kreativno ga poveži s janjetinom.
2.  **Stvori priču:** Ispričaj toplu i primamljivu priču o jelu. Opiši njegovu povijest, sastojke, način pripreme i, što je najvažnije, okuse koji ga čine posebnim. Obavezno uključi i neku zanimljivu povijesnu priču ili zabavnu činjenicu o jelu! Usporedi ga s poznatim dalmatinskim jelima od janjetine (poput janjetine s ražnja ili peke) kako bi stvorio referentnu točku.
3.  **Završi s pitanjem:** Završi svoj odgovor otvorenim pitanjem kako bi potaknuo korisnika na daljnji razgovor. Na primjer: "Jeste li ikada probali nešto slično?" ili "Zvuči li vam ovo ukusno?".
4.  **Generiraj upit za sliku:** Na samom kraju odgovora, nakon svog teksta, dodaj poseban marker \`IMAGE_PROMPT:\` nakon kojeg slijedi detaljan i živopisan opis jela za generiranje fotorealistične slike. Opis treba biti na engleskom jeziku i sadržavati detalje o izgledu jela, tanjuru, pozadini i osvjetljenju.

Primjer strukture odgovora:
"Divan odabir lokacije! U ${location} nezaobilazno jelo je... [Ovdje ide tvoja priča o jelu, usporedba s dalmatinskom janjetinom, zabavna činjenica, itd.]... Što mislite o tome?

IMAGE_PROMPT: A photorealistic image of [dish name], steaming hot on a rustic ceramic plate, garnished with fresh herbs. The background is a cozy, traditional restaurant with warm lighting. Close-up shot, mouth-watering details."

Tvoj odgovor mora biti na hrvatskom jeziku (osim dijela IMAGE_PROMPT).`;

    try {
      const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      return response.text ?? '';
    } catch (error) {
      console.error('Error in generateCulinaryAnalysis:', error);
      throw new Error('Failed to generate culinary analysis.');
    }
  }

  async generateDishImage(prompt: string): Promise<string> {
    try {
      const response = await this.ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: prompt,
          config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '16:9'
          }
      });
  
      if (response.generatedImages && response.generatedImages.length > 0) {
          const base64ImageBytes = response.generatedImages[0].image.imageBytes;
          return `data:image/jpeg;base64,${base64ImageBytes}`;
      } else {
          throw new Error('No image was generated.');
      }
    } catch (error) {
      console.error('Error in generateDishImage:', error);
      throw new Error('Failed to generate dish image.');
    }
  }

  async analyzeImage(base64Image: string, prompt: string): Promise<string> {
    try {
      const imagePart = {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image,
        },
      };
      const textPart = { text: prompt };
  
      const response = await this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: { parts: [imagePart, textPart] },
      });
      return response.text ?? '';
    } catch (error) {
      console.error('Error in analyzeImage:', error);
      throw new Error('Failed to analyze image.');
    }
  }

  async findRestaurants(chatHistory: ChatMessage[]): Promise<string> {
    const systemInstruction = `Ti si Lamb Advisor, vrhunski AI kuhar i precizan lokalni vodič. Tvoj zadatak je pronaći stvarne, provjerene restorane za korisnika koristeći Google Maps.

Analiziraj cijelu povijest razgovora kako bi identificirao lokaciju korisnika i jelo o kojem se razgovaralo (prvenstveno "pečena janjetina na ražnju").

**STRATEGIJA PRETRAGE (OBAVEZNO SLIJEDITI REDOSLIJED):**
Koristeći isključivo googleMaps alat, izvrši pretragu u progresivnim radijusima:
1.  **Prvo traži unutar 5 km** od lokacije korisnika restorane koji poslužuju "janjetina na ražnju" ili "janjetina".
2.  **Ako ne pronađeš relevantne rezultate**, proširi pretragu na **10 km**.
3.  **Ako i dalje nema rezultata**, proširi pretragu na **25 km**.
4.  **Konačno, ako je potrebno, proširi pretragu na 50 km**.
5.  Ako pronađeš restorane, navedi u kojem radijusu su pronađeni.

**PRAVILA STVARNOSTI (NAJVAŽNIJE):**
- Koristi **isključivo googleMaps alat**.
- **NE SMIJEŠ IZMIŠLJATI** restorane, njihova imena, ocjene ili detalje. Svi podaci moraju doći iz alata.
- Za svaki restoran, navedi ime, sažetak onoga po čemu je poznat (posebno vezano za janjetinu) i, ako je dostupno, ocjenu.

Pronađi do 3 najbolje ocijenjena lokalna restorana.

**FORMATIRANJE IZLAZA (OBAVEZNO):**
Tvoj odgovor MORA biti formatiran točno na sljedeći način koristeći markdown:

Naravno, evo nekoliko sjajnih restorana u blizini, na temelju podataka s Google Mapsa:

**[Ime prvog restorana]**
*Ocjena: [npr. 4.7/5 prema recenzijama]*
*MapsQuery: [npr. Ime+Restorana, Grad] (Mora biti formatiran za URL, s '+' umjesto razmaka)*
_[Ovdje ide tvoj kratak sažetak. Npr: "Poznati po izvrsnoj janjetini s ražnja. Pronađen unutar radijusa od 10 km."]_

**[Ime drugog restorana]**
*Ocjena: [npr. 4.9/5 prema recenzijama]*
*MapsQuery: [npr. Drugo+Ime, Adresa]*
_[Ovdje ide tvoj kratak sažetak. Npr: "Gosti hvale njihove obilne porcije janjetine. Pronađen unutar radijusa od 25 km."]_

Ako ne možeš pronaći nijedan restoran ni unutar 50 km, obavijesti korisnika o tome.
Odgovori isključivo na hrvatskom jeziku.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: chatHistory,
            config: {
                tools: [{ googleMaps: {} }],
                systemInstruction,
            }
        });
        
        // Maps tool does not return grounding chunks like search, so we remove that logic.
        return response.text ?? '';

    } catch (error) {
        console.error('Error in findRestaurants:', error);
        throw new Error('Failed to find restaurants.');
    }
  }

  async continueChat(chatHistory: ChatMessage[]): Promise<string> {
    const systemInstruction = `Ti si Lamb Advisor, vrhunski AI kuhar s toplom i zanimljivom osobnošću. Tvoja misija je voditi korisnike na kulinarsko putovanje kroz jela od janjetine i kozletine. Održavaj razgovor, odgovaraj na pitanja i budi entuzijastičan. Kad god je prikladno, podijeli neku zabavnu činjenicu ili kratku anegdotu vezanu uz kulinarstvo. Tvoji odgovori moraju biti na hrvatskom jeziku.`;
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: chatHistory,
        config: {
          systemInstruction,
        }
      });
      return response.text ?? '';
    } catch (error) {
      console.error('Error in continueChat:', error);
      throw new Error('Failed to continue chat.');
    }
  }
}