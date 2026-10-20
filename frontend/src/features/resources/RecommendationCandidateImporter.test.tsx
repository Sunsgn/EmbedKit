import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecommendationCandidateImporter from './RecommendationCandidateImporter';

const mocks = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('../../services/partSources', async importOriginal => ({ ...(await importOriginal<typeof import('../../services/partSources')>()), lookupOnlinePart: mocks.lookup }));

beforeEach(() => mocks.lookup.mockReset());

describe('RecommendationCandidateImporter', () => {
  it('lets the user confirm extracted models before exact lookup and import', async () => {
    mocks.lookup.mockResolvedValue({ query: 'STM32G474RET6', productName: 'STM32G474RET6', manufacturer: 'STMicroelectronics', description: 'MCU', specs: { 'Operating temperature': '-40–85 °C' }, features: [], source: 'Test source', productUrl: 'https://example.com/part' });
    const onAdd = vi.fn();
    render(<RecommendationCandidateImporter onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /导入 AI 或外部推荐/ }));
    fireEvent.change(screen.getByLabelText('推荐文本'), { target: { value: '- STM32G474RET6：支持 CAN FD' } });
    fireEvent.click(screen.getByRole('button', { name: '提取候选' }));
    expect(screen.getByText('STM32G474RET6')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查询并加入当前角色' }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd.mock.calls[0][0][0]).toMatchObject({ mpn: 'STM32G474RET6', parameters: [{ key: 'raw:operating-temperature', status: 'imported' }] });
    expect(onAdd.mock.calls[0][0][0].evidence.at(-1).note).toContain('不作为器件参数证据');
  });
});
