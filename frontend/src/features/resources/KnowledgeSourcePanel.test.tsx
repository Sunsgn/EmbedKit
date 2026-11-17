import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import KnowledgeSourcePanel from './KnowledgeSourcePanel';

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
    fireEvent.change(screen.getByRole('textbox', { name: '搜索开发资料目录' }), { target: { value: 'SLE' } });
    expect(screen.getByRole('region', { name: '星闪 NearLink 资料目录' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'ESP32 资料目录' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: '搜索开发资料目录' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: '按平台筛选资料' }), { target: { value: 'RV1106' } });
    expect(screen.getByRole('region', { name: 'RV1106 资料目录' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '通用基础 资料目录' })).not.toBeInTheDocument();
  });
});
