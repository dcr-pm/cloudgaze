import { AnalysisResult } from '../types';

export async function analyzeCloudImage(base64ImageData: string): Promise<AnalysisResult> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64ImageData }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred on the server.' }));
        throw new Error(errorData.message || `Server responded with status: ${response.status}`);
    }

    const result = await response.json();

    if (Array.isArray(result)) {
      return result as AnalysisResult;
    } else {
      console.error("API response was not in the expected array format:", result);
      throw new Error("The AI returned an unexpected response format.");
    }
  } catch (e) {
    console.error("Error calling backend analysis function:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    throw new Error(`Failed to analyze image: ${errorMessage}`);
  }
}