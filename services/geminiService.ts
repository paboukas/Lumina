
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { MODEL_NAME, SYSTEM_INSTRUCTION } from "../constants";

/**
 * Resizes a base64 image to exactly 800x600 using a canvas.
 * This ensures the user's specific resolution requirement is met perfectly.
 */
async function resizeImage(base64: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = (err) => reject(err);
  });
}

export interface EditImageResult {
  image: string;
  usage: {
    prompt: number;
    candidate: number;
  };
}

export async function editImage(
  base64Image: string,
  prompt: string,
  mimeType: string = 'image/jpeg'
): Promise<EditImageResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const cleanBase64 = base64Image.split(',')[1] || base64Image;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType,
            },
          },
          {
            text: `[EDITORIAL_DIRECTIVE]: ${prompt}. 
            CRITICAL INSTRUCTIONS:
            1. REMOVE EVERY SINGLE PERSON FROM THE IMAGE. THE SCENE MUST BE PURE AND EMPTY.
            2. PUSH COLORS TO EXPLOSIVE, BREATHTAKING TRAVEL MAGAZINE VIBRANCY. 
            3. USE "ULTRA-LUMINOUS" SATURATION FOR ALL CHANNELS. 
            4. APPLY MAXIMUM CRYSTALLINE SHARPENING.
            5. OUTPUT TARGET: 800x600.
            6. NO TEXT OUTPUT.`,
          },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        imageConfig: {
          aspectRatio: "4:3"
        }
      }
    });

    let editedImageBase64: string | null = null;

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          editedImageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!editedImageBase64) {
      const reason = response.candidates?.[0]?.finishReason;
      if (reason === 'SAFETY') {
        throw new Error("Το περιεχόμενο μπλοκαρίστηκε από τα φίλτρα ασφαλείας. Δοκιμάστε άλλη φωτογραφία.");
      }
      throw new Error("Το μοντέλο δεν κατάφερε να παράγει εικόνα. Δοκιμάστε ξανά.");
    }

    const resizedImage = await resizeImage(editedImageBase64, 800, 600);
    
    return {
      image: resizedImage,
      usage: {
        prompt: response.usageMetadata?.promptTokenCount || 0,
        candidate: response.usageMetadata?.candidatesTokenCount || 0
      }
    };
  } catch (error: any) {
    console.error("Gemini Edit Error:", error);
    
    // Εξειδικευμένο σφάλμα για Rate Limits (429)
    if (error.message?.includes('429') || error.status === 429) {
      throw new Error("Studio Overload: Έχετε φτάσει το όριο ταχύτητας του API. Περιμένετε 1 λεπτό πριν τη χιλιοστή φωτογραφία!");
    }
    
    throw error;
  }
}
