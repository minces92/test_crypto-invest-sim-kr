import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

interface PromptMetadata {
  name: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens?: number;
}

interface LoadedPrompt {
  metadata: PromptMetadata;
  template: string;
}

const promptCache = new Map<string, LoadedPrompt>();

export async function loadPrompt(promptName: string): Promise<LoadedPrompt> {
  if (promptCache.has(promptName)) {
    return promptCache.get(promptName)!;
  }

  const filePath = path.join(process.cwd(), 'src', 'prompts', `${promptName}.md`);
  
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const { data, content } = matter(fileContent);

    // Basic validation for metadata
    if (!data.name || !data.description || !data.model || typeof data.temperature !== 'number') {
      throw new Error(`Invalid metadata in prompt file: ${promptName}.md`);
    }

    const loadedPrompt: LoadedPrompt = {
      metadata: data as PromptMetadata,
      template: content.trim(),
    };
    promptCache.set(promptName, loadedPrompt);
    return loadedPrompt;
  } catch (error) {
    console.error(`Error loading prompt ${promptName}:`, error);
    throw new Error(`Failed to load prompt: ${promptName}`);
  }
}

export function fillPromptTemplate(template: string, data: Record<string, any>): string {
  let filledTemplate = template;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      filledTemplate = filledTemplate.replace(placeholder, String(data[key]));
    }
  }
  return filledTemplate;
}
