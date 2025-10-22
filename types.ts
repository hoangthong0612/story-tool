export interface StoryboardScene {
    id: string;
    caption: string;
    imagePrompt: string;
    imageUrl?: string;
    imageIsLoading: boolean;
}

export interface Character {
    id: string;
    name: string;
    description: string;
    refImage?: File;
    refImageUrl?: string;
    refImageBase64?: string;
    promptImage?: string;
}