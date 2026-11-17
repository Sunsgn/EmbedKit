import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteKnowledgeDocumentDatabaseForTests } from '../services/knowledgeDocumentLibrary';
import { deleteLocalPartDocumentDatabaseForTests } from '../services/partDocumentLibrary';
import ChipLibPage from './ChipLibPage';

beforeEach(async () => { localStorage.clear(); vi.unstubAllGlobals(); await deleteLocalPartDocumentDatabaseForTests(); await deleteKnowledgeDocumentDatabaseForTests(); });

describe('ChipLibPage layout', () => {
  it('uses a functional directory before opening mutually exclusive workspaces', () => {
    render(<ChipLibPage />);
    expect(screen.getByRole('region', { name: '资料中心功能目录' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '器件与方案' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '开发资料与知识' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索型号、参数或用途/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /型号查询与资料包/ }));
    expect(screen.getByPlaceholderText(/搜索型号、参数或用途/)).toBeInTheDocument();
    expect(screen.queryByText('开源开发资料')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /批量核验 AI 给出的型号/ }));
    expect(screen.getByRole('heading', { name: '批量型号核验' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索型号、参数或用途/)).not.toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('solution');
    fireEvent.click(screen.getByRole('button', { name: '返回功能目录' }));
    fireEvent.click(screen.getByRole('button', { name: /我的资料与记录/ }));
    expect(screen.getByRole('heading', { name: '我的资料与选型记录' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '批量型号核验' })).not.toBeInTheDocument();
  });

  it('opens development sources as an independent second-level workspace', () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /开源开发资料/ }));
    expect(screen.getByRole('region', { name: 'ESP32 资料目录' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'RV1106 资料目录' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/搜索型号、参数或用途/)).not.toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('sources');
    fireEvent.click(screen.getByRole('button', { name: '返回功能目录' }));
    expect(screen.getByRole('region', { name: '资料中心功能目录' })).toBeInTheDocument();
  });

  it('opens the offline embedded development knowledge base and persists the workspace', async () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /知识与工程经验/ }));
    expect(await screen.findByRole('region', { name: '嵌入式开发知识库' })).toHaveClass('theme-panel-soft', 'theme-border');
    expect(screen.getByRole('textbox', { name: '搜索知识库' })).toBeInTheDocument();
    expect(screen.getByText('27 份内置文档')).toBeInTheDocument();
    expect(localStorage.getItem('embedkit.resources-mode')).toBe('knowledge');
    fireEvent.change(screen.getByRole('textbox', { name: '搜索知识库' }), { target: { value: 'DMA 物理位映射' } });
    expect(screen.getByRole('button', { name: /嵌入式 Linux 问题解决及开发规避/ })).toBeInTheDocument();
  });

  it('imports and searches a local document inside the knowledge base', async () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /知识与工程经验/ }));
    await screen.findByRole('region', { name: '嵌入式开发知识库' });
    fireEvent.click(screen.getByRole('button', { name: '导入文档' }));
    fireEvent.change(screen.getByLabelText('选择知识库文档'), { target: { files: [new File(['# CAN 调试\n检查终端电阻与错误帧。'], 'can-guide.md', { type: 'text/markdown' })] } });
    expect(await screen.findByRole('button', { name: /CAN 调试/ })).toBeInTheDocument();
    expect(screen.getAllByText(/检查终端电阻与错误帧/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('textbox', { name: '搜索导入文档' }), { target: { value: '错误帧' } });
    expect(screen.getByRole('button', { name: /CAN 调试/ })).toBeInTheDocument();
    expect(localStorage.getItem('embedkit.knowledge-workspace')).toBe('documents');
  });

  it('records local engineering experience and blocks unverified conclusions', async () => {
    render(<ChipLibPage />);
    fireEvent.click(screen.getByRole('button', { name: /知识与工程经验/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /功能选型与型号核验/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /型号查询与资料包/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /型号查询与资料包/ }));
    fireEvent.change(screen.getByPlaceholderText(/搜索型号、参数或用途/), { target: { value: 'BME280' } });
    fireEvent.change(screen.getByLabelText('选择本地规格书 PDF'), { target: { files: [new File([new TextEncoder().encode('%PDF-1.4\nfixture')], 'BME280-user-guide.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('button', { name: '删除本地资料 BME280-user-guide' })).toBeInTheDocument();
    expect(screen.getByText('2 份可直接使用')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除本地资料 BME280-user-guide' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '删除本地资料 BME280-user-guide' })).not.toBeInTheDocument());
  });
});
