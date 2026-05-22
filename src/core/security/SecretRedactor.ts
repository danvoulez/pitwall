const SECRET_PATTERNS = [
  /(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GH_TOKEN|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID)\s*=\s*\S+/gi,
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  /(?:password|passwd|secret|token|api_key|apikey|api-key|auth_token|access_token)\s*[=:]\s*['"]?[^\s'"]{8,}/gi,
  /(?:sk-|pk-|ghp_|gho_|ghu_|ghs_|ghr_|xoxb-|xoxp-|xapp-)\S{20,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

export function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

export function containsSecrets(text: string): boolean {
  return SECRET_PATTERNS.some(p => p.test(text));
}
