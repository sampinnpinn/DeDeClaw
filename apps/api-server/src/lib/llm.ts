import { getConfigByCustomId } from '../routes/modelConfig.js';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

interface LLMConfig {
  baseUrl: string;
  modelName: string;
  apiKey: string;
}

interface ChatCompletionOptions {
  skipWebSearchProxy?: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResult {
  content: string;
  usage: LLMUsage;
}

const WEB_SEARCH_PROXY_MODEL_CUSTOM_ID = 'qwen3.5-plus';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function isQwenModel(modelName: string): boolean {
  return modelName.toLowerCase().includes('qwen');
}

function isWebSearchEnabled(extraBody?: Record<string, unknown>): boolean {
  return extraBody?.enable_search === true;
}

function stripEnableSearch(extraBody?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extraBody) return undefined;
  const nextBody = { ...extraBody };
  delete nextBody.enable_search;
  return nextBody;
}

function buildProxyAugmentedSystemPrompt(
  systemPrompt: string | undefined,
  webSearchContent: string,
): string {
  const searchSection = [
    '【联网检索结果（由 qwen3.5-plus 提供）】',
    webSearchContent,
    '【使用要求】',
    '- 优先基于以上检索结果回答。',
    '- 若检索结果与问题无关，请明确说明并谨慎作答。',
    '- 禁止编造未在检索结果中出现的事实。',
  ].join('\n');

  if (!systemPrompt) {
    return searchSection;
  }

  return `${systemPrompt}\n\n${searchSection}`;
}

export async function callLLM(
  modelCustomId: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  extraBody?: Record<string, unknown>,
): Promise<LLMResult> {
  const config = await getConfigByCustomId(modelCustomId);
  if (!config) {
    throw new Error(`Model config "${modelCustomId}" not found or disabled`);
  }
  return callLLMWithConfigInternal(config, messages, systemPrompt, extraBody);
}

export async function callLLMWithConfig(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt?: string,
  extraBody?: Record<string, unknown>,
): Promise<LLMResult> {
  return callLLMWithConfigInternal(config, messages, systemPrompt, extraBody);
}

async function callLLMWithConfigInternal(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt?: string,
  extraBody?: Record<string, unknown>,
  options?: ChatCompletionOptions,
): Promise<LLMResult> {
  const shouldProxyWebSearch = !options?.skipWebSearchProxy
    && isWebSearchEnabled(extraBody)
    && !isQwenModel(config.modelName);

  if (shouldProxyWebSearch) {
    const proxyConfig = await getConfigByCustomId(WEB_SEARCH_PROXY_MODEL_CUSTOM_ID);
    if (!proxyConfig) {
      throw new Error(`Web search proxy model "${WEB_SEARCH_PROXY_MODEL_CUSTOM_ID}" not found or disabled`);
    }

    const searchResult = await callLLMWithConfigInternal(
      proxyConfig,
      messages,
      systemPrompt,
      { ...extraBody, enable_search: true },
      { skipWebSearchProxy: true },
    );

    const augmentedSystemPrompt = buildProxyAugmentedSystemPrompt(systemPrompt, searchResult.content);
    const cleanedExtraBody = stripEnableSearch(extraBody);

    return callLLMWithConfigInternal(
      config,
      messages,
      augmentedSystemPrompt,
      cleanedExtraBody,
      { skipWebSearchProxy: true },
    );
  }

  const fullMessages: ChatMessage[] = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const requestBody: Record<string, unknown> = {
    model: config.modelName,
    messages: fullMessages,
    stream: false,
    ...(isQwenModel(config.modelName) ? { enable_thinking: false } : {}),
    ...extraBody,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };

  const content = data.choices[0]?.message?.content ?? '';

  const promptTokens = data.usage?.prompt_tokens
    ?? estimateTokens(fullMessages.map((m) => m.content).join(''));
  const completionTokens = data.usage?.completion_tokens
    ?? estimateTokens(content);
  const totalTokens = data.usage?.total_tokens ?? (promptTokens + completionTokens);

  return { content, usage: { promptTokens, completionTokens, totalTokens } };
}

/**
 * 流式调用 LLM，通过 onToken 回调逐 token 输出，返回完整内容
 */
export async function callLLMWithConfigStream(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onToken: (token: string) => void,
  extraBody?: Record<string, unknown>,
): Promise<LLMResult> {
  return callLLMWithConfigStreamInternal(config, messages, systemPrompt, onToken, extraBody);
}

async function callLLMWithConfigStreamInternal(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onToken: (token: string) => void,
  extraBody?: Record<string, unknown>,
  options?: ChatCompletionOptions,
): Promise<LLMResult> {
  const shouldProxyWebSearch = !options?.skipWebSearchProxy
    && isWebSearchEnabled(extraBody)
    && !isQwenModel(config.modelName);

  if (shouldProxyWebSearch) {
    const proxyConfig = await getConfigByCustomId(WEB_SEARCH_PROXY_MODEL_CUSTOM_ID);
    if (!proxyConfig) {
      throw new Error(`Web search proxy model "${WEB_SEARCH_PROXY_MODEL_CUSTOM_ID}" not found or disabled`);
    }

    const searchResult = await callLLMWithConfigInternal(
      proxyConfig,
      messages,
      systemPrompt,
      { ...extraBody, enable_search: true },
      { skipWebSearchProxy: true },
    );

    const augmentedSystemPrompt = buildProxyAugmentedSystemPrompt(systemPrompt, searchResult.content);
    const cleanedExtraBody = stripEnableSearch(extraBody);

    return callLLMWithConfigStreamInternal(
      config,
      messages,
      augmentedSystemPrompt,
      onToken,
      cleanedExtraBody,
      { skipWebSearchProxy: true },
    );
  }

  const fullMessages: ChatMessage[] = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/chat/completions`;
  const requestBody: Record<string, unknown> = {
    model: config.modelName,
    messages: fullMessages,
    stream: true,
    ...(isQwenModel(config.modelName) ? { enable_thinking: false } : {}),
    ...extraBody,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;

      try {
        const json = JSON.parse(trimmed.slice(6)) as {
          choices: Array<{ delta: { content?: string } }>;
        };
        const token = json.choices[0]?.delta?.content ?? '';
        if (token) {
          fullContent += token;
          onToken(token);
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  const promptTokens = estimateTokens(fullMessages.map((m) => m.content).join(''));
  const completionTokens = estimateTokens(fullContent);
  return {
    content: fullContent,
    usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
  };
}

export async function callLLMStream(
  modelCustomId: string,
  messages: ChatMessage[],
  systemPrompt: string,
  onToken: (token: string) => void,
  extraBody?: Record<string, unknown>,
): Promise<LLMResult> {
  const config = await getConfigByCustomId(modelCustomId);
  if (!config) {
    throw new Error(`Model config "${modelCustomId}" not found or disabled`);
  }
  return callLLMWithConfigStreamInternal(config, messages, systemPrompt, onToken, extraBody);
}
