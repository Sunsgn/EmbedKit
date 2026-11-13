import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalPartDocumentDatabaseForTests } from '../services/partDocumentLibrary';
import ChipLibPage from './ChipLibPage';

beforeEach(async () => { localStorage.clear(); vi.unstubAllGlobals(); await deleteLocalPartDocumentDatabaseForTests(); });

describe('ChipLibPage layout', () => {
  it('keeps model lookup primary and opens batch verification as a secondary workspace', () => {
    render(<ChipLibPage />);
    expect(screen.getByPlaceholderText(/搜索型号、参数或用途/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /方案选型与验证/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /批量核验 AI 给出的型号/ }));
    expect(screen.getByRole('heading', { name: '批量型号核验' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索型号、参数或用途/)).not.toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('solution');
    fireEvent.click(screen.getByRole('button', { name: /我的资料与选型记录/ }));
    expect(screen.getByRole('heading', { name: '我的资料与选型记录' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '批量型号核验' })).not.toBeInTheDocument();
  });

  it('opens the offline embedded development knowledge base and persists the workspace', async () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /嵌入式开发知识库/ }));
    expect(await screen.findByRole('region', { name: '嵌入式开发知识库' })).toHaveClass('theme-panel-soft', 'theme-border');
    expect(screen.getByRole('textbox', { name: '搜索知识库' })).toBeInTheDocument();
    expect(screen.getByText('19 份文档')).toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('knowledge');
    fireEvent.change(screen.getByRole('textbox', { name: '搜索知识库' }), { target: { value: 'DMA 物理位映射' } });
    expect(screen.getByRole('button', { name: /嵌入式 Linux 问题解决及开发规避/ })).toBeInTheDocument();
  });

  it('records local engineering experience and blocks unverified conclusions', async () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /嵌入式开发知识库/ }));
    await screen.findByRole('region', { name: '嵌入式开发知识库' });
    fireEvent.click(screen.getByRole('button', { name: '本地工程经验' }));
    expect(screen.getByRole('heading', { name: '记录真实问题经验' }).closest('article')).toHaveClass('theme-canvas');
    fireEvent.change(screen.getByLabelText('标题 *'), { target: { value: 'UART DMA 超时' } });
    fireEvent.change(screen.getByLabelText('症状 *'), { target: { value: '连续接收后停止' } });
    fireEvent.change(screen.getByLabelText('记录状态'), { target: { value: 'verified' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('alert')).toHaveTextContent('证据引用和复测步骤');
    fireEvent.change(screen.getByLabelText('记录状态'), { target: { value: 'draft' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByRole('status')).toHaveTextContent('经验记录已保存');
    expect(localStorage.getItem('embedkit.knowledge-experiences')).toContain('UART DMA 超时');
    expect(localStorage.getItem('embedkit.knowledge-workspace')).toBe('experiences');
  });

  it('carries pasted recommendation candidates into the verification workspace', () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /批量核验 AI 给出的型号/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '型号或推荐内容' }), { target: { value: '推荐 STM32G474RET6 和 S32K144' } });
    expect(screen.getByText('STM32G474RET6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '核验 2 个型号' }));
    expect(screen.getByText('方案核验工作台')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '推荐文本' })).toHaveValue('推荐 STM32G474RET6 和 S32K144');
    expect(screen.getByText(/识别 2 个候选/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '当前角色类别' })).toHaveValue('custom');
    fireEvent.change(screen.getByRole('combobox', { name: '当前角色类别' }), { target: { value: 'mcu' } });
    expect(screen.getByRole('combobox', { name: '当前角色类别' })).toHaveValue('mcu');
  });

  it('shows only verified official documents and keeps unresolved kinds non-clickable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, model: 'BME280', manufacturer: 'Bosch Sensortec', documents: [{ kind: 'user-guide', title: 'BME280 User Guide', url: 'https://www.bosch-sensortec.com/BME280-UG.pdf', sourceName: 'Bosch Sensortec', authoritative: true, scope: 'exact-model', discoveredFrom: 'https://www.bosch-sensortec.com/products/BME280' }], failures: [], discoveredAt: '2026-10-20T00:00:00.000Z' }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } })));
    render(<ChipLibPage />);
    fireEvent.change(screen.getByPlaceholderText(/搜索型号、参数或用途/), { target: { value: 'BME280' } });
    expect(screen.getByRole('heading', { name: '官方技术资料' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /数据手册/ })).toHaveTextContent('打开官方 PDF');
    expect(await screen.findByText(/已从 Bosch Sensortec 官方页面发现 1 份 PDF/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /用户／使用手册/ })).toHaveTextContent('打开官方 PDF');
    expect(screen.queryByRole('link', { name: /应用笔记/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /硬件设计指南/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /入门指南/ })).not.toBeInTheDocument();
    expect(screen.getByText('尚未发现官方文件')).toBeInTheDocument();
    expect(screen.getByText(/不提供搜索引擎跳转/)).toBeInTheDocument();
  });

  it('imports, restores and deletes a local PDF for the current model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ schemaVersion: 1, model: 'BME280', manufacturer: 'Bosch Sensortec', documents: [], failures: [], discoveredAt: '2026-10-20T00:00:00.000Z' }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-EmbedKit-Protocol': '1' } })));
    render(<ChipLibPage />);
    fireEvent.change(screen.getByPlaceholderText(/搜索型号、参数或用途/), { target: { value: 'BME280' } });
    fireEvent.change(screen.getByLabelText('选择本地规格书 PDF'), { target: { files: [new File([new TextEncoder().encode('%PDF-1.4\nfixture')], 'BME280-user-guide.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('button', { name: '删除本地资料 BME280-user-guide' })).toBeInTheDocument();
    expect(screen.getByText('2 份可直接使用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除本地资料 BME280-user-guide' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '删除本地资料 BME280-user-guide' })).not.toBeInTheDocument());
  });
});
