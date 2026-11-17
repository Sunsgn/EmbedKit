import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import KnowledgeSourcePanel from './KnowledgeSourcePanel';
import { buildOpenSourceSearchLinks, OPEN_SOURCE_SEARCH_MAX_LENGTH } from './openSourceSearch';

describe('KnowledgeSourcePanel', () => {
  it('renders platform directories with traceable source levels', () => {
    render(<KnowledgeSourcePanel />);
    const espDirectory = screen.getByRole('region', { name: 'ESP32 资料目录' });
    expect(within(espDirectory).getByRole('link', { name: /ESP-IDF Programming Guide/ })).toHaveAttribute('href', 'https://docs.espressif.com/projects/esp-idf/en/latest/');
    expect(screen.getByRole('region', { name: 'RV1106 资料目录' })).toHaveTextContent('Luckfox Pico Wiki');
    expect(screen.getByRole('region', { name: '星闪 NearLink 资料目录' })).toHaveTextContent('核验时暂不可达');
  });

  it('searches aliases and filters the directory by platform', () => {
    render(<KnowledgeSourcePanel />);
    fireEvent.change(screen.getByRole('textbox', { name: '搜索开源开发资料' }), { target: { value: 'SLE' } });
    expect(screen.getByRole('region', { name: '星闪 NearLink 资料目录' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'ESP32 资料目录' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '在线搜索 GitHub 仓库' })).toHaveAttribute('href', 'https://github.com/search?type=repositories&q=SLE');
    expect(screen.getByRole('link', { name: '在线搜索 Gitee 仓库' })).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.change(screen.getByRole('textbox', { name: '搜索开源开发资料' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: '按平台筛选资料' }), { target: { value: 'RV1106' } });
    expect(screen.getByRole('region', { name: 'RV1106 资料目录' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '通用基础 资料目录' })).not.toBeInTheDocument();
  });

  it('builds bounded encoded external searches without local data', () => {
    const links = buildOpenSourceSearchLinks(`  RV1106 SDK & examples ${'x'.repeat(OPEN_SOURCE_SEARCH_MAX_LENGTH)}  `);
    expect(links).toHaveLength(3);
    expect(links.every(link => link.url.startsWith('https://'))).toBe(true);
    expect(links[0].url).toContain('RV1106%20SDK%20%26%20examples');
    expect(buildOpenSourceSearchLinks('x')).toEqual([]);
  });
});
