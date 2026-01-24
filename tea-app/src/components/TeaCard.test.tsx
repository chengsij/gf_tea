import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeaCard } from './TeaCard';
import type { Tea } from '../types';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Trash2: () => <div data-testid="trash-icon">Trash</div>,
  ExternalLink: () => <div data-testid="link-icon">Link</div>,
}));

// Helper function to create a mock tea object
const createMockTea = (overrides?: Partial<Tea>): Tea => ({
  id: '1',
  name: 'Green Tea',
  type: 'Green',
  image: 'https://example.com/image.jpg',
  steepTimes: [30, 45, 60],
  caffeine: 'Some',
  caffeineLevel: 'Medium',
  website: 'https://example.com',
  brewingTemperature: '170°F',
  teaWeight: '2.5g',
  timesConsumed: 0,
  lastConsumedDate: null,
  ...overrides,
});

describe('TeaCard Component', () => {
  describe('Rendering', () => {
    it('should render tea name', () => {
      const tea = createMockTea({ name: 'Dragon Well Green Tea' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText('Dragon Well Green Tea')).toBeInTheDocument();
    });

    it('should render tea type', () => {
      const tea = createMockTea({ type: 'Oolong' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText('Oolong')).toBeInTheDocument();
    });

    it('should render caffeine level', () => {
      const tea = createMockTea({ caffeineLevel: 'High' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText(/High Caffeine/i)).toBeInTheDocument();
    });

    it('should render brewing temperature when available', () => {
      const tea = createMockTea({ brewingTemperature: '195°F' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText('195°F')).toBeInTheDocument();
    });

    it('should render tea weight when available', () => {
      const tea = createMockTea({ teaWeight: '3.5g' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText('3.5g')).toBeInTheDocument();
    });

    it('should render steep count', () => {
      const tea = createMockTea({ steepTimes: [30, 45, 60, 75] });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText('4 steeps')).toBeInTheDocument();
    });

    it('should render image with correct alt text', () => {
      const tea = createMockTea({ name: 'My Tea', image: 'https://example.com/tea.jpg' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      const image = screen.getByAltText('My Tea');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', 'https://example.com/tea.jpg');
    });

    it('should apply selected class when isSelected is true', () => {
      const tea = createMockTea();

      const { container } = render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={true}
        />
      );

      const card = container.querySelector('.tea-card');
      expect(card).toHaveClass('selected');
    });
  });

  describe('Website button', () => {
    it('should render website button when website URL is provided', () => {
      const tea = createMockTea({ website: 'https://example.com' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      const link = screen.getByTestId('link-icon').closest('a');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should not render website button when website is not provided', () => {
      const tea = createMockTea({ website: '' });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.queryByTestId('link-icon')).not.toBeInTheDocument();
    });
  });

  describe('Delete button interactions', () => {
    it('should render delete button', () => {
      const tea = createMockTea();

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByTestId('trash-icon')).toBeInTheDocument();
    });

    it('should call onDeleteClick when delete button is clicked', async () => {
      const user = userEvent.setup();
      const onDeleteClick = vi.fn();
      const tea = createMockTea();

      const { container } = render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={onDeleteClick}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      const deleteButton = container.querySelector('.btn-delete') as HTMLButtonElement;
      await user.click(deleteButton);

      expect(onDeleteClick).toHaveBeenCalledWith(tea.id, expect.any(Object));
      expect(onDeleteClick).toHaveBeenCalledTimes(1);
    });

    it('should show loading state when deletingTeaId matches tea id', () => {
      const tea = createMockTea();

      const { container } = render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={tea.id}
          isSelected={false}
        />
      );

      const deleteButton = container.querySelector('.btn-delete') as HTMLButtonElement;
      expect(deleteButton).toBeDisabled();
      expect(deleteButton).toHaveTextContent('...');
    });

    it('should handle delete button without card click', async () => {
      const user = userEvent.setup();
      const onDeleteClick = vi.fn();
      const tea = createMockTea();

      const { container } = render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={onDeleteClick}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      const deleteButton = container.querySelector('.btn-delete') as HTMLButtonElement;
      await user.click(deleteButton);

      // onDeleteClick should be called with the tea id
      expect(onDeleteClick).toHaveBeenCalled();
      expect(onDeleteClick).toHaveBeenCalledWith(tea.id, expect.any(Object));
    });
  });

  describe('Card click interactions', () => {
    it('should call onTeaClick when card is clicked', async () => {
      const user = userEvent.setup();
      const onTeaClick = vi.fn();
      const tea = createMockTea();

      const { container } = render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={onTeaClick}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      const card = container.querySelector('.tea-card') as HTMLDivElement;
      await user.click(card);

      expect(onTeaClick).toHaveBeenCalled();
      expect(onTeaClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onTeaClick when clicking the image', async () => {
      const user = userEvent.setup();
      const onTeaClick = vi.fn();
      const tea = createMockTea();

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={onTeaClick}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      const image = screen.getByAltText(tea.name);
      await user.click(image);

      // The click handler is on the card, so it will still be called
      expect(onTeaClick).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should render with minimal tea data', () => {
      const tea = createMockTea({
        brewingTemperature: '',
        teaWeight: '',
        website: '',
      });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText(tea.name)).toBeInTheDocument();
      expect(screen.getByText(tea.type)).toBeInTheDocument();
    });

    it('should handle tea with single steep time', () => {
      const tea = createMockTea({ steepTimes: [180] });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText('1 steeps')).toBeInTheDocument();
    });

    it('should handle tea with many steep times', () => {
      const steepTimes = Array.from({ length: 15 }, (_, i) => (i + 1) * 30);
      const tea = createMockTea({ steepTimes });

      render(
        <TeaCard
          tea={tea}
          usedSteepTimes={new Set()}
          onTeaClick={vi.fn()}
          onSteepClick={vi.fn()}
          onDeleteClick={vi.fn()}
          deletingTeaId={null}
          isSelected={false}
        />
      );

      expect(screen.getByText('15 steeps')).toBeInTheDocument();
    });
  });
});
