// This is a Netlify Function that acts as a secure proxy to the Gemini API.
// It is written in TypeScript and will be executed in a Node.js environment.

import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Define the expected structure of the incoming request body
interface RequestBody {
  image: string; // base64 encoded image data
}

// Define the structure of a successful response
interface SuccessResponse {
  statusCode: number;
  body: string; // JSON string
}

// Define the structure of an error response
interface ErrorResponse {
    statusCode: number;
    body: string; // JSON string of { message: string }
}

// Define the handler function that Netlify will execute
export const handler = async (event: { body: string | null }): Promise<SuccessResponse | ErrorResponse> => {
  // Ensure the request is a POST request
  // Note: Netlify's function routing doesn't expose the HTTP method here,
  // so we rely on the frontend to send the correct method.

  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("API_KEY environment variable not set.");
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server configuration error: API key is missing.' }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Bad request: No body provided.' }),
    };
  }

  try {
    const { image: base64ImageData } = JSON.parse(event.body) as RequestBody;

    if (!base64ImageData) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Bad request: Image data is missing.' }),
        };
    }
      
    // The data URL from canvas is `data:image/jpeg;base64,...`, so we need to strip the prefix.
    const base64Data = base64ImageData.split(',')[1];
    if (!base64Data) {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid image data format.' }),
        };
    }

    const ai = new GoogleGenAI({ apiKey });

    const responseSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          shape: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['shape', 'description'],
      },
    };

    const imagePart = { inlineData: { data: base64Data, mimeType: 'image/jpeg' } };
    const textPart = { text: "Analyze this image of clouds and creatively identify shapes of objects or animals you see. Be imaginative. Describe each shape you find. If you can't find any clear shapes, return an empty array. Return the result as a JSON array." };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
        temperature: 0.7,
      },
    });

    const jsonText = response.text.trim();
    // We can directly return the text from Gemini since it's already a JSON string.
    return {
      statusCode: 200,
      body: jsonText,
    };

  } catch (e) {
    console.error("Error in Gemini API call:", e);
    const message = e instanceof Error ? e.message : "An internal server error occurred.";
    return {
      statusCode: 500,
      body: JSON.stringify({ message }),
    };
  }
};