import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiPage from './AiPage';
import { detectLocalServers, loadStoredAiConfig, streamAiResponse } from '../services/aiService';

vi.mock('../services/aiService', () => ({
  clearStoredAiConfig: vi.fn(),
  detectLocalServers: vi.fn(),
  loadStoredAiConfig: vi.fn(() => null),
  localProxyUrl: (target: string) => `http://127.0.0.1:9999/proxy/${target}`,
  persistAiConfig: vi.fn(),
  streamAiResponse: vi.fn(),
}));

describe('AiPage local Ollama availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    vi.mocked(loadStoredAiConfig).mockReturnValue(null);
    vi.mocked(detectLocalServers).mockResolvedValue([{ name: 'Ollama', url: 'http://localhost:11434', chatUrl: 'http://localhost:11434/v1/chat/completions', models: [] }]);
  });

  it('defaults to the web API and enables real requests only after a key is configured', () => {
    render(<AiPage />);

    expect(screen.getByText(/默认使用云端网页 API/)).toBeVisible();
    expect(screen.getByText(/云端模式：发送时仅将当前对话/)).toBeVisible();
    expect(screen.getByRole('button', { name: '配置 AI 服务' })).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('问我关于嵌入式开发的问题...'), { target: { value: '分析这段代码' } });
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled();
    expect(detectLocalServers).not.toHaveBeenCalled();
    expect(streamAiResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('AI 设置'));
    expect(screen.getByText('云端优先')).toBeVisible();
    expect(screen.getByLabelText('模型')).toHaveValue('openrouter/free');
    expect(screen.getByRole('link', { name: '免费登录并获取 OpenRouter API Key' })).toHaveAttribute('href', 'https://openrouter.ai/keys');
    fireEvent.change(screen.getByPlaceholderText('输入 OpenRouter API Key'), { target: { value: 'sk-or-test-1234567890' } });
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    expect(screen.getByRole('button', { name: '发送消息' })).toBeEnabled();
  });

  it('migrates the previous generated Ollama default to the web-first configuration', () => {
    vi.mocked(loadStoredAiConfig).mockReturnValue({ provider: 'local', model: 'qwen2.5:7b', apiKey: '', customEndpoint: 'http://127.0.0.1:9999/proxy/http://localhost:11434/v1/chat/completions' });
    render(<AiPage />);

    expect(detectLocalServers).not.toHaveBeenCalled();
    expect(screen.getByText(/云端模式：发送时仅将当前对话/)).toBeVisible();
  });

  it('distinguishes a running Ollama service from an installed model', async () => {
    vi.mocked(loadStoredAiConfig).mockReturnValue({ schemaVersion: 2, provider: 'local', model: 'qwen2.5:7b', apiKey: '', customEndpoint: 'http://127.0.0.1:9999/proxy/http://localhost:11434/v1/chat/completions' });
    render(<AiPage />);

    expect(await screen.findByText('Ollama 无可用模型')).toBeVisible();
    expect(screen.getByText(/Ollama 服务已启动，但本机没有可用模型/)).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText('问我关于嵌入式开发的问题...'), { target: { value: '分析这段代码' } });
    expect(screen.getByRole('button', { name: '发送消息' })).toBeDisabled();
    expect(streamAiResponse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('AI 设置'));
    expect(await screen.findByText(/服务已启动，但尚未安装模型/)).toBeVisible();
    expect(screen.getByText('ollama pull qwen2.5:7b')).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('模型')).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: '切换免费云端' }));
    expect(screen.getByLabelText('模型')).toHaveValue('openrouter/free');
  });
});
