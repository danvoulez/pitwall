import { LLMAdapter } from '../engineer/RaceEngineer';
import { AnthropicAdapter } from './AnthropicAdapter';
import { OpenAIAdapter } from './OpenAIAdapter';
import { StubLLMAdapter } from './StubAdapter';

export type LLMProvider = 'anthropic' | 'openai' | 'stub';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
}

export function createLLMAdapter(config: LLMConfig): LLMAdapter {
  switch (config.provider) {
    case 'anthropic':
      if (!config.apiKey) throw new Error('ANTHROPIC_API_KEY required');
      return new AnthropicAdapter(config.apiKey, config.model);

    case 'openai':
      if (!config.apiKey) throw new Error('OPENAI_API_KEY required');
      return new OpenAIAdapter(config.apiKey, config.model);

    case 'stub':
    default:
      return new StubLLMAdapter();
  }
}

/**
 * Auto-detect which adapter to use from environment variables.
 * Priority: ANTHROPIC_API_KEY > OPENAI_API_KEY > stub
 */
export function autoDetectLLM(): { adapter: LLMAdapter; provider: LLMProvider } {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      adapter: new AnthropicAdapter(anthropicKey, process.env.PITWALL_LLM_MODEL),
      provider: 'anthropic',
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      adapter: new OpenAIAdapter(openaiKey, process.env.PITWALL_LLM_MODEL),
      provider: 'openai',
    };
  }

  return { adapter: new StubLLMAdapter(), provider: 'stub' };
}

export { AnthropicAdapter } from './AnthropicAdapter';
export { OpenAIAdapter } from './OpenAIAdapter';
export { StubLLMAdapter } from './StubAdapter';
