import { LLMAdapter } from '../engineer/RaceEngineer';

/**
 * Fallback adapter when no API key is configured.
 * Generates context-aware responses from the mission state
 * without calling any external API.
 */
export class StubLLMAdapter implements LLMAdapter {
  async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const lastUser = messages.filter(m => m.role === 'user').pop();
    const systemContext = messages.find(m => m.role === 'system' && m.content.includes('MISSION'));

    if (!systemContext) {
      return 'Race Engineer standing by. No mission context available yet. [stub]';
    }

    const context = systemContext.content;
    const changedMatch = context.match(/CHANGED FILES: (.+)/);
    const testMatch = context.match(/TEST RESULTS: (.+)/);
    const claimsMatch = context.match(/CLAIMS:\n([\s\S]*?)(?:\n\n|RISKS)/);
    const statusMatch = context.match(/STATUS: (\w+)/);

    const changedFiles = changedMatch?.[1] || 'none';
    const testResults = testMatch?.[1] || 'none';
    const claims = claimsMatch?.[1] || 'none';
    const status = statusMatch?.[1] || 'unknown';

    if (lastUser?.content.includes('Translate it into a clear')) {
      const instruction = lastUser.content.match(/"(.+)"/)?.[1] || lastUser.content;
      return `---\nOperator instruction:\n\n${instruction}\n\nFocus on this specific task. Report results before proceeding to anything else.\n---`;
    }

    return `Race Engineer report [stub]:

Status: ${status}
Changed files: ${changedFiles}
Tests: ${testResults}
Claims: ${claims}

${changedFiles !== 'none' && testResults === 'none'
  ? 'Warning: Files modified but no test evidence yet. Recommend running targeted tests.'
  : testResults.includes('failed')
    ? 'Tests failing. Driver should fix the failing tests before proceeding.'
    : testResults.includes('passed')
      ? 'Evidence captured via passing tests. Review diff before committing.'
      : 'Observing. No significant activity detected yet.'}

[Stub — configure ANTHROPIC_API_KEY or OPENAI_API_KEY for real Race Engineer]`;
  }
}
