"use client";
import React, { useState, useCallback, useEffect } from 'react';
import { generateStoryStream, generateStoryboardData, generateImage, generateCharacterReferenceImage } from '@/services/geminiService';
import type { StoryboardScene, Character } from '@/types';
import JSZip from 'jszip';


const MagicWandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
    <path d="M17.293 2.293a1 1 0 011.414 0l.001.001a1 1 0 010 1.414l-11 11a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L6 13.586l10.293-10.293a1 1 0 011.414 0zM12 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM4 12a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM10.5 6.5a1 1 0 00-1.414-1.414L7.672 6.5H6a1 1 0 100 2h1.672l1.414-1.414a1 1 0 000-1.414L10.5 6.5zM12.328 11H14a1 1 0 100-2h-1.672l-1.414 1.414a1 1 0 000 1.414L12.328 11z" />
    <path d="M5 2.5a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5zM2.5 5a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5zM15 17.5a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5zM12.5 15a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5z" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const StoryPreview: React.FC<{ story: string; isGenerating: boolean }> = ({ story, isGenerating }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!story && !isGenerating) return null;

  return (
    <div className="bg-brand-surface rounded-lg p-4 my-6 border border-gray-700 transition-all duration-300">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full text-left font-semibold text-lg mb-2 text-brand-on-surface">
        Full Story {isGenerating && !story ? "(Generating...)" : ""}
        <span className="float-right transition-transform duration-200">{isExpanded ? '▲' : '▼'}</span>
      </button>
      {(isExpanded || (isGenerating && !story)) && (
        <div className="prose prose-invert max-w-none text-brand-on-bg max-h-96 overflow-y-auto pr-2">
          <p style={{ whiteSpace: 'pre-wrap' }}>{story}{isGenerating && <span className="inline-block w-2 h-4 bg-brand-primary animate-pulse ml-1"></span>}</p>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [idea, setIdea] = useState('');
  const [fullStory, setFullStory] = useState('');
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);

  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const [workflowId, setWorkflowId] = React.useState<string | null>(null);

  const fetchWorkflowId = async () => {

    try {
      const res = await fetch(`/api/create-workflow`, {
        method: "GET",
        credentials: "include", // gửi cookie thật của user nếu cần
      });
      if (!res.ok) throw new Error("Không có dữ liệu");
      const data = await res.json();
      console.log("Fetched token data:", data);
      // setWorkflowId(data.status === 1 ? data.workflowId : null);
      return data;
    } catch (e) {
      console.error(e);
      // setWorkflowId(null);
      return null;
    }

  };

  const handleGenerate = useCallback(async () => {
    if (!idea.trim() || isGeneratingStory || isGeneratingStoryboard) return;

    setError(null);
    setFullStory('');
    setStoryboard([]);
    setCharacters([]);
    setIsGeneratingStory(true);

    try {
      const finalStory = await generateStoryStream(idea, (chunk) => {
        setFullStory((prev) => prev + chunk);
      });



      setIsGeneratingStory(false);

      setIsGeneratingStoryboard(true);
      const storyboardData = await generateStoryboardData(finalStory);
      const wfID = await fetchWorkflowId();
      console.log("Workflow ID data:", wfID);
      setWorkflowId(wfID.status === 1 ? wfID.workflowId : null);


      await Promise.all(storyboardData.characters.map(async (char, index) => {
        if (!char.refImageBase64) {
          try {
            const imageData = await generateCharacterReferenceImage(char.description, wfID.status === 1 ? wfID.workflowId : null);
            storyboardData.characters[index] = {
              ...char,
              id: imageData.id,
              promptImage: imageData.promptImage,
              refImageBase64: imageData.image,
              refImageUrl: `data:image/png;base64,${imageData.image}`
            };
          } catch (e) {
            throw new Error(`Failed to generate reference image for ${char.name}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }));
      setCharacters(storyboardData.characters);

      const initialScenes = storyboardData.scenes.map((scene, index) => ({
        ...scene,
        id: `scene-${index}`,
        imageIsLoading: false,
      }));
      setStoryboard(initialScenes);
      setIsGeneratingStoryboard(false);

    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
      setIsGeneratingStory(false);
      setIsGeneratingStoryboard(false);
    }
  }, [idea, isGeneratingStory, isGeneratingStoryboard]);

  useEffect(() => {
    const generateImagesForStoryboard = async () => {
      for (const scene of storyboard) {
        if (!scene.imageUrl && !scene.imageIsLoading) {
          setStoryboard(prev => prev.map(s => s.id === scene.id ? { ...s, imageIsLoading: true } : s));
          try {
            const res = await generateImage(scene.imagePrompt, workflowId ?? "", characters);
            const url = `data:image/jpeg;base64,${res.image}`;
            setStoryboard(prev => prev.map(s => s.id === scene.id ? { ...s, imageUrl: url, imageIsLoading: false } : s));
          } catch (e) {
            console.error(`Failed to generate image for scene ${scene.id}`, e);
            setStoryboard(prev => prev.map(s => s.id === scene.id ? { ...s, imageIsLoading: false, imageUrl: 'error' } : s));
          }
        }
      }
    };

    if (storyboard.length > 0 && !isGeneratingStoryboard) {
      generateImagesForStoryboard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard.length, isGeneratingStoryboard]);


  const isGenerating = isGeneratingStory || isGeneratingStoryboard;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-on-bg font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-brand-primary">InspireBoard</h1>
          <p className="text-lg text-brand-on-bg/80 mt-2">AI Storyboard Generator</p>
        </header>

        <main>
          <div className="bg-brand-surface rounded-lg p-6 shadow-2xl border border-gray-700">
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Start with a spark of inspiration, e.g., 'From failure to glory for a young artist'"
              className="w-full h-24 p-3 bg-brand-bg border-2 border-gray-600 rounded-md focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition duration-200 resize-none"
              disabled={isGenerating}
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !idea.trim()}
              className="mt-4 w-full flex items-center justify-center bg-brand-primary text-brand-bg font-bold py-3 px-4 rounded-md hover:bg-opacity-90 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              {isGenerating ? <LoadingSpinner /> : <MagicWandIcon />}
              {isGeneratingStory ? 'Crafting Your Story...' : isGeneratingStoryboard ? 'Building Storyboard...' : 'Generate Storyboard'}
            </button>
          </div>

          {error && <div className="bg-red-800/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg my-6">{error}</div>}

          <StoryPreview story={fullStory} isGenerating={isGeneratingStory} />

          {characters.length > 0 && (
            <div className="my-8">
              <h2 className="text-2xl font-bold text-brand-secondary mb-4">Main Characters</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map((char, index) => (
                  <div key={index} className="bg-brand-surface p-4 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-bold text-brand-primary">{char.name}</h3>
                    <p className="text-brand-on-bg/90 mt-1">{char.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {storyboard.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-brand-secondary mb-4">Storyboard</h2>
              <div className="hidden lg:grid grid-cols-3 gap-x-6 gap-y-2 font-bold p-4 text-brand-on-bg/80 border-b-2 border-gray-700">
                <div>Caption</div>
                <div>Image Prompt</div>
                <div>Illustration</div>
              </div>
              {storyboard.map((scene) => (
                <div key={scene.id} className="grid lg:grid-cols-3 gap-6 p-4 border-b border-gray-800 items-start">
                  <div className="lg:pr-4">
                    <h3 className="lg:hidden font-bold text-brand-secondary mb-2">Caption</h3>
                    <p className="text-brand-on-bg/90 italic">"{scene.caption}"</p>
                  </div>
                  <div className="lg:pr-4">
                    <h3 className="lg:hidden font-bold text-brand-secondary mb-2">Image Prompt</h3>
                    <p className="text-sm text-brand-on-bg/70">{scene.imagePrompt}</p>
                  </div>
                  <div>
                    <h3 className="lg:hidden font-bold text-brand-secondary mb-2">Illustration</h3>
                    <div className="aspect-video bg-brand-bg rounded-md flex items-center justify-center border border-gray-700 overflow-hidden">
                      {scene.imageIsLoading && <LoadingSpinner />}
                      {scene.imageUrl === 'error' && <span className="text-red-400 text-sm">Image failed</span>}
                      {scene.imageUrl && scene.imageUrl !== 'error' && <img src={scene.imageUrl} alt={scene.caption} className="w-full h-full object-cover" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}