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
1.  **Analiziraj lokaciju:** Tvoj **apsolutni i najvažniji prioritet** je pronaći autentično lokalno jelo od **janjetine ili kozletine**. Uloži sav svoj trud u to. Tek ako, i samo ako, nakon temeljite analize utvrdiš da takva tradicija zaista ne postoji na zadanoj lokaciji, tek tada se prebaci na najvažniji lokalni obiteljski mesni specijalitet i kreativno ga poveži s janjetinom.
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
    const systemInstruction = `Ti si Lamb Advisor, vrhunski AI kuhar i precizan lokalni vodič. Tvoj zadatak je pronaći stvarne, provjerene restorane za korisnika na temelju online recenzija.

Analiziraj cijelu povijest razgovora kako bi identificirao lokaciju korisnika i jelo o kojem se razgovaralo.

**STRATEGIJA PRETRAGE (OBAVEZNO SLIJEDITI REDOSLIJED):**
Tvoja strategija pretrage mora slijediti ove korake, točno ovim redoslijedom, koristeći isključivo googleSearch alat:
1.  **Formuliraj upite za pretragu:** Stvori specifične upite za Google, TripAdvisor i Yelp. Koristi ključne riječi poput "janjetina na ražnju", "jelo od janjetine", "janjetina" u kombinaciji s lokacijom korisnika. Primjer upita: "najbolji restorani janjetina na ražnju [lokacija] TripAdvisor recenzije".
2.  **Analiziraj rezultate pretrage:** Pregledaj rezultate pretrage kako bi pronašao restorane koji se često spominju i imaju visoke ocjene. Obrati posebnu pozornost na tekst recenzija korisnika.
3.  **Sintetiziraj recenzije:** Za svaki odabrani restoran, sažmi ključne točke iz recenzija. Što gosti govore o janjetini? Kakva je atmosfera? Je li usluga dobra?

**PRAVILA STVARNOSTI (NAJVAŽNIJE):**
- Koristi **isključivo googleSearch alat**.
- **NE SMIJEŠ IZMIŠLJATI** restorane, njihova imena, ocjene ili detalje.
- Svi podaci koje navedeš MORAJU biti utemeljeni na informacijama pronađenim u rezultatima pretrage i recenzijama.
- Opis restorana mora biti kratak sažetak onoga što korisnici pišu u recenzijama. Tvoja točnost je važnija od kreativnosti. Ne dodaji izmišljene, "primamljive" rečenice.

Pronađi do 3 najbolje ocijenjena lokalna restorana.

**FORMATIRANJE IZLAZA (OBAVEZNO):**
Tvoj odgovor MORA biti formatiran točno na sljedeći način koristeći markdown:

Naravno, evo nekoliko sjajnih restorana u blizini, na temelju recenzija korisnika s interneta:

**[Ime prvog restorana]**
*Ocjena: [npr. 4.7/5 prema recenzijama]*
_[Ovdje ide tvoj kratak sažetak recenzija. Npr: "Korisnici na TripAdvisoru često hvale njihovu savršeno pečenu janjetinu s ražnja i domaću atmosferu."]_

**[Ime drugog restorana]**
*Ocjena: [npr. 4.9/5 prema recenzijama]*
_[Ovdje ide tvoj kratak sažetak recenzija. Npr: "Prema Google recenzijama, ovo je skriveni dragulj poznat po izdašnim porcijama i odličnom omjeru cijene i kvalitete."]_

**[Ime trećeg restorana]**
*Ocjena: [npr. 4.5/5 prema recenzijama]*
_[Ovdje ide tvoj kratak sažetak recenzija.]_

Ako ne možeš pronaći dovoljno informacija za pouzdanu ocjenu ili opis, iskreno to navedi.
Odgovori isključivo na hrvatskom jeziku.`;

    try {
        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: chatHistory,
            config: {
                tools: [{ googleSearch: {} }],
                systemInstruction,
            }
        });
        
        let textResponse = response.text ?? '';
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

        if (groundingChunks && groundingChunks.length > 0) {
            const sources = groundingChunks
                // The type for groundingChunks is not exported, so using any.
                .map((chunk: any) => chunk.web)
                .filter((web: any) => web && web.uri && web.title)
                .map((web: any) => `[${web.title}](${web.uri})`);
            
            const uniqueSources = [...new Set(sources)];

            if (uniqueSources.length > 0) {
                textResponse += '\n\n**Izvori:**\n' + uniqueSources.join('\n');
            }
        }
        
        return textResponse;

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