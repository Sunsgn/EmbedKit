import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import FunctionalSelectionCenter from './FunctionalSelectionCenter';

beforeEach(() => localStorage.clear());
describe('FunctionalSelectionCenter', () => {
  it('switches between independently usable communication and MCU selection workspaces', () => {
    render(<FunctionalSelectionCenter />);
    expect(screen.getByText('按功能选型 · 通信收发器')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /MCU \/ 微控制器/ }));
    expect(screen.getByText('按功能选型 · MCU')).toBeInTheDocument();
    expect(screen.getByLabelText('MCU 最低 Flash')).toHaveValue(256);
    expect(screen.getByText('STM32F103RCT6')).toBeInTheDocument();
  });
});
