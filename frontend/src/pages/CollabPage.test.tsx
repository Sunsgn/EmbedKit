import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CollabPage from './CollabPage';
import { listEngineeringProjects } from '../services/productStorage';
import { createEngineeringProject } from '../types/product';

vi.mock('../services/productStorage', () => ({ listEngineeringProjects: vi.fn() }));
describe('collaboration handoff page', () => {
  beforeEach(() => vi.mocked(listEngineeringProjects).mockResolvedValue([createEngineeringProject('Real project')]));
  it('uses saved projects and never presents fake invitation or online members', async () => {
    render(<MemoryRouter><CollabPage /></MemoryRouter>);
    expect(await screen.findByText('Real project')).toBeVisible();
    expect(screen.queryByText(/Invite|online members/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Real project'));
    await waitFor(() => expect(screen.getByRole('button', { name: /导出 1 个工程/ })).toBeEnabled());
  });
});
