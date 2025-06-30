/**
 * UI Component Parser Tests
 * 
 * Test suite for the UI component parsing functionality
 */

import { parseUIComponents, validateUIComponent, generateSampleComponent } from '../ui-component-parser';

describe('UI Component Parser', () => {
  describe('parseUIComponents', () => {
    it('should parse a valid receipt card component', () => {
      const content = `Here's your receipt:

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "receipt_card",
  "data": {
    "receipt_id": "test-123",
    "merchant": "Test Store",
    "total": 25.50,
    "currency": "MYR",
    "date": "2024-01-15"
  },
  "metadata": {
    "title": "Test Receipt",
    "interactive": true
  }
}
\`\`\`

This is your receipt information.`;

      const result = parseUIComponents(content);

      expect(result.success).toBe(true);
      expect(result.components).toHaveLength(1);
      expect(result.components[0].component).toBe('receipt_card');
      expect(result.components[0].data.merchant).toBe('Test Store');
      expect(result.cleanedContent).toBe('Here\'s your receipt:\n\nThis is your receipt information.');
    });

    it('should parse multiple components', () => {
      const content = `Here are your results:

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "receipt_card",
  "data": {
    "receipt_id": "test-123",
    "merchant": "Test Store",
    "total": 25.50,
    "currency": "MYR",
    "date": "2024-01-15"
  },
  "metadata": {
    "title": "Test Receipt",
    "interactive": true
  }
}
\`\`\`

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "action_button",
  "data": {
    "action": "upload_receipt",
    "label": "Upload New",
    "variant": "primary"
  },
  "metadata": {
    "title": "Upload Action",
    "interactive": true
  }
}
\`\`\`

End of results.`;

      const result = parseUIComponents(content);

      expect(result.success).toBe(true);
      expect(result.components).toHaveLength(2);
      expect(result.components[0].component).toBe('receipt_card');
      expect(result.components[1].component).toBe('action_button');
    });

    it('should handle invalid JSON gracefully', () => {
      const content = `Here's invalid JSON:

\`\`\`ui_component
{
  "type": "ui_component",
  "component": "receipt_card",
  "data": {
    "receipt_id": "test-123"
    "merchant": "Missing comma"
  }
}
\`\`\`

This should fail parsing.`;

      const result = parseUIComponents(content);

      expect(result.success).toBe(false);
      expect(result.components).toHaveLength(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should handle content without components', () => {
      const content = 'This is just regular text without any components.';

      const result = parseUIComponents(content);

      expect(result.success).toBe(true);
      expect(result.components).toHaveLength(0);
      expect(result.cleanedContent).toBe(content);
    });
  });

  describe('validateUIComponent', () => {
    it('should validate a correct receipt card component', () => {
      const component = {
        type: 'ui_component',
        component: 'receipt_card',
        data: {
          receipt_id: 'test-123',
          merchant: 'Test Store',
          total: 25.50,
          currency: 'MYR',
          date: '2024-01-15'
        },
        metadata: {
          title: 'Test Receipt',
          interactive: true
        }
      };

      const result = validateUIComponent(component);

      expect(result.valid).toBe(true);
      expect(result.component).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid component type', () => {
      const component = {
        type: 'ui_component',
        component: 'invalid_type',
        data: {},
        metadata: {
          title: 'Test',
          interactive: true
        }
      };

      const result = validateUIComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject missing required fields', () => {
      const component = {
        type: 'ui_component',
        component: 'receipt_card',
        data: {
          // Missing required fields
        },
        metadata: {
          title: 'Test',
          interactive: true
        }
      };

      const result = validateUIComponent(component);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('generateSampleComponent', () => {
    it('should generate a valid receipt card sample', () => {
      const sample = generateSampleComponent('receipt_card');

      expect(sample.type).toBe('ui_component');
      expect(sample.component).toBe('receipt_card');
      expect(sample.data).toBeDefined();
      expect(sample.metadata).toBeDefined();

      // Validate the generated sample
      const validation = validateUIComponent(sample);
      expect(validation.valid).toBe(true);
    });

    it('should generate a valid action button sample', () => {
      const sample = generateSampleComponent('action_button');

      expect(sample.type).toBe('ui_component');
      expect(sample.component).toBe('action_button');
      expect(sample.data).toBeDefined();
      expect(sample.metadata).toBeDefined();

      // Validate the generated sample
      const validation = validateUIComponent(sample);
      expect(validation.valid).toBe(true);
    });
  });
});
