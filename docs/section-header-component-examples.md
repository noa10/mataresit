# Section Header Component Examples

The SectionHeaderComponent provides structured organization for chat responses with markdown-style headers that support various styling options, collapsible sections, and visual hierarchy.

## Features

### 1. Header Levels (H1-H6)
- **H1**: Large, prominent headers with card layout
- **H2-H3**: Medium headers with border separators
- **H4-H6**: Smaller headers for subsections

### 2. Visual Variants
- **Default**: Standard styling
- **Primary**: Brand color highlighting
- **Success**: Green theme for positive content
- **Warning**: Yellow theme for cautions
- **Error**: Red theme for errors
- **Info**: Blue theme for informational content

### 3. Interactive Features
- **Collapsible**: Sections can be collapsed/expanded
- **Anchors**: Clickable headers for navigation
- **Badges**: Status indicators and labels
- **Icons**: Visual enhancement with Lucide icons

### 4. Responsive Design
- **Compact Mode**: Smaller sizing for mobile
- **Flexible Layout**: Adapts to container width
- **Touch-Friendly**: Large touch targets

## Example Usage in LLM Responses

### Basic Headers
```markdown
# Receipt Analysis Summary
## Transaction Details
### Payment Information
```

### Enhanced Headers with Components
```json
{
  "type": "ui_component",
  "component": "section_header",
  "data": {
    "title": "Receipt Analysis Summary",
    "level": 1,
    "subtitle": "Analysis of your recent transactions",
    "icon": "bookmark",
    "variant": "primary",
    "badge": {
      "text": "7 receipts",
      "variant": "secondary"
    },
    "divider": true
  }
}
```

## Component Examples

### 1. Main Section Header (H1)
```json
{
  "type": "ui_component",
  "component": "section_header",
  "data": {
    "title": "Financial Summary",
    "level": 1,
    "subtitle": "Your spending overview for January 2024",
    "icon": "star",
    "variant": "primary",
    "badge": {
      "text": "Updated",
      "variant": "default"
    },
    "divider": true
  }
}
```

### 2. Collapsible Subsection (H2)
```json
{
  "type": "ui_component",
  "component": "section_header",
  "data": {
    "title": "Transaction Details",
    "level": 2,
    "subtitle": "Click to expand/collapse",
    "collapsible": true,
    "collapsed": false,
    "icon": "info",
    "variant": "default"
  }
}
```

### 3. Status Headers
```json
{
  "type": "ui_component",
  "component": "section_header",
  "data": {
    "title": "Processing Complete",
    "level": 2,
    "icon": "check",
    "variant": "success",
    "badge": {
      "text": "Success",
      "variant": "default"
    }
  }
}
```

### 4. Warning Section
```json
{
  "type": "ui_component",
  "component": "section_header",
  "data": {
    "title": "Attention Required",
    "level": 2,
    "subtitle": "Some receipts need manual review",
    "icon": "alert",
    "variant": "warning",
    "badge": {
      "text": "3 items",
      "variant": "destructive"
    }
  }
}
```

### 5. Compact Subsection (H3)
```json
{
  "type": "ui_component",
  "component": "section_header",
  "data": {
    "title": "Merchant Breakdown",
    "level": 3,
    "icon": "hash",
    "variant": "default"
  }
}
```

## Integration with Chat Responses

The SectionHeaderComponent automatically renders when:

1. **Markdown Headers**: LLM generates markdown headers (# ## ###)
2. **Structured Responses**: Backend generates section_header components
3. **Content Organization**: Chat responses need visual hierarchy

### Example LLM Response with Headers
```
# Receipt Analysis Results

I found 7 receipts matching your search criteria.

## Summary Statistics
- Total Amount: MYR 245.30
- Average per receipt: MYR 35.04
- Date range: 15/01/2024 - 20/01/2024

## Transaction Details

| Merchant | Date | Amount | Category |
|----------|------|--------|----------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | Groceries |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Groceries |

### Payment Methods
Most transactions were paid with cash.
```

This markdown will be automatically enhanced with SectionHeaderComponents for better visual organization.

## Styling Variants

### Default Theme
- Clean, minimal styling
- Consistent with chat interface
- Good contrast ratios

### Primary Theme
- Brand color highlighting
- Used for main sections
- Draws attention to important content

### Status Themes
- **Success**: Green for completed actions
- **Warning**: Yellow for attention items
- **Error**: Red for problems
- **Info**: Blue for informational content

## Accessibility Features

- **Semantic HTML**: Proper heading hierarchy
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: ARIA labels and descriptions
- **High Contrast**: Works with dark/light themes
- **Focus Management**: Clear focus indicators

## Performance Considerations

- **Lightweight**: Minimal DOM impact
- **Memoized**: Optimized re-rendering
- **Responsive**: Efficient layout calculations
- **Icon Loading**: Lazy-loaded icon components

## Best Practices

1. **Hierarchy**: Use proper heading levels (H1 → H2 → H3)
2. **Consistency**: Stick to one variant per section type
3. **Accessibility**: Don't skip heading levels
4. **Content**: Keep titles concise and descriptive
5. **Icons**: Use meaningful icons that enhance understanding

The SectionHeaderComponent provides a professional way to organize chat content with clear visual hierarchy and interactive features that enhance the user experience.
