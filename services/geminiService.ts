import { GoogleGenAI, Type } from "@google/genai";
import type { Character } from '@/types';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const STORY_GENERATION_MODEL = 'gemini-2.5-pro';
const STORYBOARD_GENERATION_MODEL = 'gemini-2.5-flash';
const IMAGE_GENERATION_MODEL = 'imagen-4.0-generate-001';

const DEFAULT_IMAGE_STYLE = "semi-realistic, detailed, cinematic lighting, golden hour, graphic novel aesthetic, digital illustration, emotional tone, warm color palette";

const storyboardSchema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      description: "Descriptions of up to 3 main characters from the story.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "The character's name." },
          description: { type: Type.STRING, description: "A detailed description of the character's appearance, personality, and role in the story." }
        },
        required: ['name', 'description']
      }
    },
    scenes: {
      type: Type.ARRAY,
      description: "An array of storyboard scenes, extracted sequentially from the story.",
      items: {
        type: Type.OBJECT,
        properties: {
          caption: {
            type: Type.STRING,
            description: "A sequential and verbatim segment of the story, under 20 words. Each caption must be an exact substring from the original text. All captions, when concatenated, should perfectly reconstruct the full story in its original order."
          },
          imagePrompt: {
            type: Type.STRING,
            description: "A detailed visual prompt for an AI image generator to create an illustration for this scene. Do not include style information."
          }
        },
        required: ['caption', 'imagePrompt']
      }
    }
  },
  required: ['characters', 'scenes']
};

export const generateStoryStream = async (idea: string, onChunk: (chunk: string) => void): Promise<string> => {
  const prompt = `You are an inspiring storyteller. Write a full, complete, and emotionally resonant story of at least 1250 words based on the following idea: "${idea}". The story must follow a clear arc: starting with challenges and struggles, moving through a process of effort and learning, and culminating in success and triumph. Weave in a relevant and inspiring quote from a famous person naturally into the narrative. The tone should be cinematic, warm, deep, and heartfelt.`;

  const response = await ai.models.generateContentStream({
    model: STORYBOARD_GENERATION_MODEL,
    contents: prompt,
  });

  let fullStory = "";
  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      fullStory += text;
      onChunk(text);
    }
  }
  return fullStory;
};

export const generateStoryboardData = async (fullStory: string): Promise<{ characters: Character[], scenes: { caption: string; imagePrompt: string }[] }> => {
  const prompt = `
Analyze the following story and break it down into a complete, sequential storyboard.
Follow these strict rules for generating the JSON output:
1.  **Characters**: Identify and describe up to 3 main characters.
2.  **Scenes**: Deconstruct the ENTIRE story into a sequence of scenes.
3.  **Captions**:
    - Each caption MUST be a direct, verbatim quote from the story. DO NOT paraphrase, summarize, or change any words.
    - The captions must be in the exact same order as they appear in the story.
    - When all captions are joined together, they must form the complete, original story text without any gaps or missing parts.
    - Split the story into captions at natural breaks (like the end of a sentence or a significant clause) to create scenes. Keep each caption under 20 words.
4.  **Image Prompts**: For each caption, create a corresponding descriptive prompt for an image generator that visually represents that specific part of the story. Do not include style information in the prompt.

Do not include any text outside the final JSON object.

The story is:
\`\`\`
${fullStory}
\`\`\`
`;

  const response = await ai.models.generateContent({
    model: STORYBOARD_GENERATION_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: storyboardSchema,
    },
  });

  const jsonText = (response.text ?? "").trim();
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    console.error("Failed to parse storyboard JSON:", e);
    throw new Error("The AI returned invalid storyboard data. Please try again.");
  }
};

export const generateImage = async (prompt: string, workflowId: string, characters: Character[]): Promise<any> => {
  const fullPrompt = `${prompt}, style: ${DEFAULT_IMAGE_STYLE}`;

  try {
    const res = await fetch(`/api/create-image-have-subject`, {
      method: "POST",
      credentials: "include", // gửi cookie thật của user nếu cần
      body: JSON.stringify({ workflowId, prompt: fullPrompt, characters }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error("Không có dữ liệu");
    const data = await res.json();
    console.log("Fetched token data:", data);
    // Use the image panels from the fetched response (try common property names)
    const imagePanels = data?.imagePanels ?? data?.imagePanels ?? [];
    const imagePart = imagePanels[0]?.generatedImages?.[0]?.encodedImage;
    if (!imagePart) throw new Error("Reference image data not found in response.");
    
    // return `data:image/jpeg;base64,${base64ImageBytes}`;
    return {
      id: imagePanels[0]?.generatedImages?.[0]?.mediaGenerationId,
      image: imagePart
    };
  } catch (e) {
    throw new Error("Reference image data not found in response.");
  }

};


export const generateCharacterReferenceImage = async (description: string, workflowId: string): Promise<any> => {
  // const ai = getAi();

  const prompt = `${description}.
Style: ${DEFAULT_IMAGE_STYLE}. 
`;

  // const imageResponse = await ai.models.generateContent({
  //   model: 'gemini-2.5-flash-image',
  //   contents: { parts: [{ text: prompt }] },
  //   config: { responseModalities: [Modality.IMAGE] }
  // });

  try {
    const res = await fetch(`/api/create-subject-text`, {
      method: "POST",
      credentials: "include", // gửi cookie thật của user nếu cần
      body: JSON.stringify({ workflowId, prompt }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) throw new Error("Không có dữ liệu");
    const data = await res.json();
    console.log("Fetched token data:", data);
    // Use the image panels from the fetched response (try common property names)
    const imagePanels = data?.imagePanels ?? data?.imagePanels ?? [];
    const imagePart = imagePanels[0]?.generatedImages?.[0]?.encodedImage;
    if (!imagePart) throw new Error("Reference image data not found in response.");
    return {
      image: imagePart,
      id: imagePanels[0]?.generatedImages?.[0]?.mediaGenerationId,
      promptImage: imagePanels[0]?.prompt
    };
  } catch (e) {
    throw new Error("Reference image data not found in response.");
  }

  // const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  // const imageData = imagePart?.inlineData?.data;
  // if (!imageData) {
  //   throw new Error("Reference image data not found in response.");
  // }
  // return imageData;
};