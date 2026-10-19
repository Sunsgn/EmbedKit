import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PartSelectionPanel from './PartSelectionPanel';

describe('PartSelectionPanel', () => {
  it('shows deterministic reasons for retained and excluded communication candidates', () => {
    render(<PartSelectionPanel />);
    const tja = screen.getByText('TJA1051T').closest('article');
    const max = screen.getByText('MAX3485').closest('article');
    expect(tja).not.toBeNull();
    expect(max).not.toBeNull();
    expect(within(tja!).getByText('候选，需核验')).toBeInTheDocument();
    expect(within(max!).getByText('已排除')).toBeInTheDocument();
    expect(within(max!).getByText(/不满足：RS-485/)).toBeInTheDocument();
  });

  it('marks missing temperature evidence unknown instead of silently accepting it', () => {
    render(<PartSelectionPanel />);
    fireEvent.click(screen.getByLabelText('工作温度作为硬条件'));
    const tja = screen.getByText('TJA1051T').closest('article');
    expect(within(tja!).getByText(/没有可靠参数/)).toBeInTheDocument();
    expect(within(tja!).getByText(/未知 1/)).toBeInTheDocument();
  });
});
