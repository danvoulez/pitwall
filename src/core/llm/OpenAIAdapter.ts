import OpenAI from 'openai';
import { LLMAdapter } from '../engineer/RaceEngineer';

export class OpenAIAdapter implements LLMAdapter {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model = 'gpt-4o') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const formatted = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: formatted,
      max_tokens: 1024,
    });

    return response.choices[0]?.message?.content ?? '';
  }
}
