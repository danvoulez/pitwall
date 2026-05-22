import Anthropic from '@anthropic-ai/sdk';
import { LLMAdapter } from '../engineer/RaceEngineer';

export class AnthropicAdapter implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const systemMessages = messages.filter(m => m.role === 'system');
    const systemText = systemMessages.map(m => m.content).join('\n\n');

    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Anthropic requires alternating user/assistant, starting with user
    const sanitized = this.ensureAlternating(conversationMessages);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: systemText,
      messages: sanitized,
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.text ?? '';
  }

  private ensureAlternating(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (messages.length === 0) {
      return [{ role: 'user', content: 'Status report please.' }];
    }

    const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Must start with user
    if (messages[0].role !== 'user') {
      result.push({ role: 'user', content: '(context)' });
    }

    for (const msg of messages) {
      const last = result[result.length - 1];
      if (last && last.role === msg.role) {
        // Merge consecutive same-role messages
        last.content += '\n\n' + msg.content;
      } else {
        result.push({ ...msg });
      }
    }

    return result;
  }
}
