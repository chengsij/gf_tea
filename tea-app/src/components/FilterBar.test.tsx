import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon">Search</div>,
}));

describe('FilterBar Component', () => {
  const defaultProps = {
    searchTerm: '',
    onSearchChange: vi.fn(),
    selectedType: null,
    onTypeChange: vi.fn(),
    selectedCaffeineLevel: null,
    onCaffeineLevelChange: vi.fn(),
    uniqueTypes: ['Green', 'Black', 'Oolong'],
  };

  describe('Search Input', () => {
    it('should render search input', () => {
      render(<FilterBar {...defaultProps} />);

      const input = screen.getByPlaceholderText('Search teas...');
      expect(input).toBeInTheDocument();
    });

    it('should display current search term', () => {
      render(<FilterBar {...defaultProps} searchTerm="Green" />);

      const input = screen.getByPlaceholderText('Search teas...') as HTMLInputElement;
      expect(input.value).toBe('Green');
    });

    it('should call onSearchChange when typing', async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          searchTerm=""
          onSearchChange={onSearchChange}
        />
      );

      const input = screen.getByPlaceholderText('Search teas...') as HTMLInputElement;
      await user.type(input, 'green');

      // onChange is called for each keystroke
      expect(onSearchChange).toHaveBeenCalledTimes(5); // g, r, e, e, n
      // Check that it was called with the final values
      expect(onSearchChange).toHaveBeenNthCalledWith(1, 'g');
      expect(onSearchChange).toHaveBeenNthCalledWith(5, 'n');
    });

    it('should handle clearing search term', async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          searchTerm="Dragon Well"
          onSearchChange={onSearchChange}
        />
      );

      const input = screen.getByPlaceholderText('Search teas...') as HTMLInputElement;
      await user.clear(input);

      expect(onSearchChange).toHaveBeenLastCalledWith('');
    });

    it('should render search icon', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });
  });

  describe('Type Filter Buttons', () => {
    it('should render "All Types" button', () => {
      render(<FilterBar {...defaultProps} />);

      const allTypesButton = screen.getByRole('button', { name: /All Types/i });
      expect(allTypesButton).toBeInTheDocument();
    });

    it('should render type buttons for each unique type', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Green' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Black' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Oolong' })).toBeInTheDocument();
    });

    it('should highlight "All Types" when no type is selected', () => {
      render(
        <FilterBar {...defaultProps} selectedType={null} />
      );

      const allTypesButton = screen.getByRole('button', { name: /All Types/i });
      expect(allTypesButton).toHaveClass('active');
    });

    it('should highlight selected type button', () => {
      render(
        <FilterBar {...defaultProps} selectedType="Oolong" />
      );

      const oolongButton = screen.getByRole('button', { name: 'Oolong' });
      expect(oolongButton).toHaveClass('active');

      const allTypesButton = screen.getByRole('button', { name: /All Types/i });
      expect(allTypesButton).not.toHaveClass('active');
    });

    it('should call onTypeChange with null when "All Types" is clicked', async () => {
      const user = userEvent.setup();
      const onTypeChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          selectedType="Green"
          onTypeChange={onTypeChange}
        />
      );

      const allTypesButton = screen.getByRole('button', { name: /All Types/i });
      await user.click(allTypesButton);

      expect(onTypeChange).toHaveBeenCalledWith(null);
    });

    it('should call onTypeChange with selected type', async () => {
      const user = userEvent.setup();
      const onTypeChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          onTypeChange={onTypeChange}
        />
      );

      const greenButton = screen.getByRole('button', { name: 'Green' });
      await user.click(greenButton);

      expect(onTypeChange).toHaveBeenCalledWith('Green');
    });

    it('should handle multiple type selections sequentially', async () => {
      const user = userEvent.setup();
      const onTypeChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          selectedType={null}
          onTypeChange={onTypeChange}
        />
      );

      const greenButton = screen.getByRole('button', { name: 'Green' });
      await user.click(greenButton);
      expect(onTypeChange).toHaveBeenCalledWith('Green');

      const blackButton = screen.getByRole('button', { name: 'Black' });
      await user.click(blackButton);
      expect(onTypeChange).toHaveBeenCalledWith('Black');
    });
  });

  describe('Caffeine Level Filter Buttons', () => {
    it('should render "All Levels" button', () => {
      render(<FilterBar {...defaultProps} />);

      const allLevelsButton = screen.getByRole('button', { name: /All Levels/i });
      expect(allLevelsButton).toBeInTheDocument();
    });

    it('should render caffeine level buttons', () => {
      render(<FilterBar {...defaultProps} />);

      // CAFFEINE_LEVELS from types: ['None', 'Low', 'Medium', 'High']
      expect(screen.getByRole('button', { name: 'None' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Low' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
    });

    it('should highlight "All Levels" when no caffeine level is selected', () => {
      render(<FilterBar {...defaultProps} selectedCaffeineLevel={null} />);

      const allLevelsButton = screen.getByRole('button', { name: /All Levels/i });
      expect(allLevelsButton).toHaveClass('active');
    });

    it('should highlight selected caffeine level button', () => {
      render(
        <FilterBar {...defaultProps} selectedCaffeineLevel="High" />
      );

      const highButton = screen.getByRole('button', { name: 'High' });
      expect(highButton).toHaveClass('active');

      const allLevelsButton = screen.getByRole('button', { name: /All Levels/i });
      expect(allLevelsButton).not.toHaveClass('active');
    });

    it('should call onCaffeineLevelChange with null when "All Levels" is clicked', async () => {
      const user = userEvent.setup();
      const onCaffeineLevelChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          selectedCaffeineLevel="Medium"
          onCaffeineLevelChange={onCaffeineLevelChange}
        />
      );

      const allLevelsButton = screen.getByRole('button', { name: /All Levels/i });
      await user.click(allLevelsButton);

      expect(onCaffeineLevelChange).toHaveBeenCalledWith(null);
    });

    it('should call onCaffeineLevelChange with selected level', async () => {
      const user = userEvent.setup();
      const onCaffeineLevelChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          onCaffeineLevelChange={onCaffeineLevelChange}
        />
      );

      const mediumButton = screen.getByRole('button', { name: 'Medium' });
      await user.click(mediumButton);

      expect(onCaffeineLevelChange).toHaveBeenCalledWith('Medium');
    });

    it('should handle multiple caffeine level selections sequentially', async () => {
      const user = userEvent.setup();
      const onCaffeineLevelChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          selectedCaffeineLevel={null}
          onCaffeineLevelChange={onCaffeineLevelChange}
        />
      );

      const lowButton = screen.getByRole('button', { name: 'Low' });
      await user.click(lowButton);
      expect(onCaffeineLevelChange).toHaveBeenCalledWith('Low');

      const highButton = screen.getByRole('button', { name: 'High' });
      await user.click(highButton);
      expect(onCaffeineLevelChange).toHaveBeenCalledWith('High');
    });
  });

  describe('Independent Filters', () => {
    it('should allow selecting type and caffeine level independently', async () => {
      const user = userEvent.setup();
      const onTypeChange = vi.fn();
      const onCaffeineLevelChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          selectedType={null}
          selectedCaffeineLevel={null}
          onTypeChange={onTypeChange}
          onCaffeineLevelChange={onCaffeineLevelChange}
        />
      );

      const greenButton = screen.getByRole('button', { name: 'Green' });
      const highButton = screen.getByRole('button', { name: 'High' });

      await user.click(greenButton);
      await user.click(highButton);

      expect(onTypeChange).toHaveBeenCalledWith('Green');
      expect(onCaffeineLevelChange).toHaveBeenCalledWith('High');
    });

    it('should handle clearing one filter without affecting another', async () => {
      const user = userEvent.setup();
      const onTypeChange = vi.fn();
      const onCaffeineLevelChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          selectedType="Green"
          selectedCaffeineLevel="High"
          onTypeChange={onTypeChange}
          onCaffeineLevelChange={onCaffeineLevelChange}
        />
      );

      const allTypesButton = screen.getByRole('button', { name: /All Types/i });
      await user.click(allTypesButton);

      expect(onTypeChange).toHaveBeenCalledWith(null);
      expect(onCaffeineLevelChange).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should render with empty types array', () => {
      render(
        <FilterBar
          {...defaultProps}
          uniqueTypes={[]}
        />
      );

      // Should still have "All Types" button
      expect(screen.getByRole('button', { name: /All Types/i })).toBeInTheDocument();
      // Should have caffeine level buttons
      expect(screen.getByRole('button', { name: 'High' })).toBeInTheDocument();
    });

    it('should handle types with special characters', async () => {
      const user = userEvent.setup();
      const onTypeChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          uniqueTypes={['PuEr', 'White-Peony', 'Yellow*Gold']}
          onTypeChange={onTypeChange}
        />
      );

      const puerButton = screen.getByRole('button', { name: 'PuEr' });
      await user.click(puerButton);

      expect(onTypeChange).toHaveBeenCalledWith('PuEr');
    });

    it('should render search icon correctly', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });
  });

  describe('Integration Between Search and Filters', () => {
    it('should maintain search term while changing type filter', async () => {
      const user = userEvent.setup();
      const onTypeChange = vi.fn();

      render(
        <FilterBar
          {...defaultProps}
          searchTerm="Jasmine"
          onTypeChange={onTypeChange}
        />
      );

      const input = screen.getByPlaceholderText('Search teas...') as HTMLInputElement;
      expect(input.value).toBe('Jasmine');

      const greenButton = screen.getByRole('button', { name: 'Green' });
      await user.click(greenButton);

      expect(onTypeChange).toHaveBeenCalledWith('Green');
      expect(input.value).toBe('Jasmine'); // Search term should persist
    });
  });
});
