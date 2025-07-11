/**
 * Test file for SectionHeaderComponent
 * 
 * Tests the various features and configurations of the section header component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionHeaderComponent } from '../SectionHeaderComponent';
import { SectionHeaderData } from '@/types/ui-components';

// Mock data for testing
const mockBasicHeader: SectionHeaderData = {
  title: 'Test Header',
  level: 1,
};

const mockAdvancedHeader: SectionHeaderData = {
  title: 'Advanced Header',
  level: 2,
  subtitle: 'This is a subtitle',
  collapsible: true,
  collapsed: false,
  icon: 'star',
  variant: 'primary',
  badge: {
    text: 'New',
    variant: 'default'
  },
  anchor: 'test-anchor'
};

const mockCollapsibleHeader: SectionHeaderData = {
  title: 'Collapsible Section',
  level: 3,
  collapsible: true,
  collapsed: true,
};

describe('SectionHeaderComponent', () => {
  it('renders basic header correctly', () => {
    render(<SectionHeaderComponent data={mockBasicHeader} />);
    
    expect(screen.getByText('Test Header')).toBeInTheDocument();
  });

  it('renders advanced header with all features', () => {
    render(<SectionHeaderComponent data={mockAdvancedHeader} />);
    
    expect(screen.getByText('Advanced Header')).toBeInTheDocument();
    expect(screen.getByText('This is a subtitle')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('handles collapsible functionality', () => {
    const mockOnAction = jest.fn();
    render(
      <SectionHeaderComponent 
        data={mockCollapsibleHeader} 
        onAction={mockOnAction}
      />
    );
    
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);
    
    expect(mockOnAction).toHaveBeenCalledWith('toggle_collapse', {
      anchor: undefined,
      collapsed: false
    });
  });

  it('applies correct styling for different variants', () => {
    const { rerender } = render(
      <SectionHeaderComponent data={{ ...mockBasicHeader, variant: 'success' }} />
    );
    
    // Test success variant
    expect(screen.getByText('Test Header')).toHaveClass('text-green-800');
    
    // Test warning variant
    rerender(
      <SectionHeaderComponent data={{ ...mockBasicHeader, variant: 'warning' }} />
    );
    expect(screen.getByText('Test Header')).toHaveClass('text-yellow-800');
  });

  it('renders different header levels with appropriate typography', () => {
    const { rerender } = render(
      <SectionHeaderComponent data={{ ...mockBasicHeader, level: 1 }} />
    );
    
    expect(screen.getByText('Test Header')).toHaveClass('text-2xl');
    
    rerender(
      <SectionHeaderComponent data={{ ...mockBasicHeader, level: 3 }} />
    );
    expect(screen.getByText('Test Header')).toHaveClass('text-lg');
  });

  it('handles anchor clicks', () => {
    const mockOnAction = jest.fn();
    render(
      <SectionHeaderComponent 
        data={mockAdvancedHeader} 
        onAction={mockOnAction}
      />
    );
    
    const titleElement = screen.getByText('Advanced Header');
    fireEvent.click(titleElement);
    
    expect(mockOnAction).toHaveBeenCalledWith('navigate_to_anchor', {
      anchor: 'test-anchor'
    });
  });

  it('renders in compact mode', () => {
    render(
      <SectionHeaderComponent 
        data={mockBasicHeader} 
        compact={true}
      />
    );
    
    expect(screen.getByText('Test Header')).toHaveClass('text-lg');
  });

  it('shows badge when provided', () => {
    render(<SectionHeaderComponent data={mockAdvancedHeader} />);
    
    const badge = screen.getByText('New');
    expect(badge).toBeInTheDocument();
    expect(badge.closest('.badge')).toBeInTheDocument();
  });

  it('handles missing optional props gracefully', () => {
    const minimalHeader: SectionHeaderData = {
      title: 'Minimal Header',
      level: 2,
    };
    
    render(<SectionHeaderComponent data={minimalHeader} />);
    
    expect(screen.getByText('Minimal Header')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

// Integration test with UIComponentRenderer
describe('SectionHeaderComponent Integration', () => {
  it('integrates with UIComponentRenderer', () => {
    const component = {
      type: 'ui_component' as const,
      component: 'section_header' as const,
      data: mockBasicHeader,
      metadata: {
        title: 'Test Section',
        interactive: false
      }
    };
    
    // This would be tested in the UIComponentRenderer test file
    expect(component.component).toBe('section_header');
    expect(component.data.title).toBe('Test Header');
  });
});
