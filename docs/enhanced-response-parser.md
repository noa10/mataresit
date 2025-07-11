# Enhanced Response Parser Documentation

The enhanced UI component parser automatically detects and converts markdown structures in LLM responses into interactive UI components, providing a seamless bridge between text-based AI responses and rich user interfaces.

## Features

### 1. Automatic Markdown Table Detection
- **Smart Column Type Detection**: Automatically identifies currency, date, number, badge, and text columns
- **Responsive Tables**: Generates mobile-friendly data tables with sorting and filtering
- **Content Analysis**: Analyzes cell content patterns to determine optimal column types
- **Performance Optimization**: Handles large tables with pagination and row limits

### 2. Markdown Header Conversion
- **Hierarchical Headers**: Converts H1-H6 markdown headers to styled section components
- **Visual Variants**: Applies appropriate styling based on header level
- **Content Organization**: Improves content structure and readability

### 3. Enhanced Parsing Options
- **Configurable Processing**: Enable/disable specific parsing features
- **Performance Controls**: Set limits for table rows and processing
- **Content Analysis**: Analyze content before processing for optimization

## API Reference

### Core Functions

#### `parseUIComponents(content: string): UIComponentParseResult`
Main parsing function that processes all markdown structures and JSON blocks.

```typescript
const result = parseUIComponents(content);
console.log(result.components); // Array of UI components
console.log(result.cleanedContent); // Content with markdown removed
```

#### `parseUIComponentsWithOptions(content: string, options: ParseOptions): UIComponentParseResult`
Enhanced parsing with configuration options.

```typescript
const result = parseUIComponentsWithOptions(content, {
  parseMarkdownTables: true,
  parseMarkdownHeaders: true,
  parseJsonBlocks: true,
  defaultCurrency: 'MYR',
  tableRowLimit: 50
});
```

### Analysis Functions

#### `analyzeMarkdownContent(content: string)`
Analyzes content to detect markdown structures without parsing.

```typescript
const analysis = analyzeMarkdownContent(content);
console.log(analysis.hasMarkdownTables); // boolean
console.log(analysis.tableCount); // number
console.log(analysis.headerLevels); // number[]
```

#### `extractTablePreview(content: string, maxRows?: number)`
Extracts table structure and preview data.

```typescript
const preview = extractTablePreview(content, 3);
console.log(preview.tables[0].headers); // string[]
console.log(preview.tables[0].totalRows); // number
```

## Column Type Detection

The parser uses intelligent analysis to determine the best column type for each table column:

### Detection Rules

1. **Header Analysis**: Examines column header keywords
   - "amount", "total", "price" → Currency
   - "date", "time" → Date
   - "category", "status", "type" → Badge
   - "count", "number", "qty" → Number

2. **Content Pattern Analysis**: Analyzes cell values
   - Currency patterns: `MYR 25.50`, `$25.50`, `25.50`
   - Date patterns: `15/01/2024`, `2024-01-15`
   - Number patterns: `1,234.56`, `42`
   - Category patterns: Limited unique values, short text

3. **Statistical Analysis**: Uses content distribution
   - 70%+ matching pattern → Assign specific type
   - Limited unique values → Badge type
   - Default → Text type

### Column Alignment

- **Currency/Number**: Right-aligned for better readability
- **Badge/Status**: Center-aligned for visual balance
- **Text/Date**: Left-aligned for natural reading

## Example Transformations

### Simple Receipt Table
```markdown
| Merchant | Date | Amount | Category |
|----------|------|--------|----------|
| SUPER SEVEN | 15/01/2024 | MYR 17.90 | Groceries |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Groceries |
```

**Becomes:**
- Interactive data table with sorting
- Currency column (right-aligned)
- Date column with proper formatting
- Badge column for categories
- Search and filter capabilities

### Headers with Content
```markdown
# Receipt Analysis Summary
## Transaction Details
### Payment Information
```

**Becomes:**
- Section header components with proper hierarchy
- Visual styling based on level
- Improved content organization

## Integration with Chat Interface

### Automatic Processing
The enhanced parser is automatically used in:
1. **Chat Message Rendering**: Processes LLM responses in real-time
2. **Backend Response Generation**: Converts markdown in edge functions
3. **UI Component System**: Seamlessly integrates with existing components

### Performance Considerations
- **Lazy Processing**: Only processes visible content
- **Memoized Results**: Caches parsing results for efficiency
- **Row Limits**: Prevents performance issues with large tables
- **Progressive Enhancement**: Graceful fallback to plain text

## Configuration Options

### ParseOptions Interface
```typescript
interface ParseOptions {
  parseMarkdownTables?: boolean;    // Default: true
  parseMarkdownHeaders?: boolean;   // Default: true
  parseJsonBlocks?: boolean;        // Default: true
  defaultCurrency?: string;         // Default: 'MYR'
  tableRowLimit?: number;           // Default: 100
}
```

### Usage Examples

#### Disable Header Parsing
```typescript
parseUIComponentsWithOptions(content, {
  parseMarkdownHeaders: false
});
```

#### Limit Table Size
```typescript
parseUIComponentsWithOptions(content, {
  tableRowLimit: 25
});
```

#### Tables Only
```typescript
parseUIComponentsWithOptions(content, {
  parseMarkdownTables: true,
  parseMarkdownHeaders: false,
  parseJsonBlocks: false
});
```

## Error Handling

### Graceful Degradation
- **Malformed Tables**: Skips invalid tables, continues processing
- **Invalid Headers**: Ignores malformed headers, processes valid ones
- **Mixed Content**: Handles combination of valid and invalid structures

### Error Reporting
```typescript
const result = parseUIComponents(content);
if (!result.success) {
  console.log(result.errors); // Array of error messages
}
```

## Best Practices

### For LLM Responses
1. **Use Standard Markdown**: Follow GitHub Flavored Markdown table syntax
2. **Clear Headers**: Use descriptive column headers
3. **Consistent Data**: Maintain consistent data formats within columns
4. **Reasonable Size**: Keep tables under 100 rows for best performance

### For Developers
1. **Test Edge Cases**: Handle malformed markdown gracefully
2. **Monitor Performance**: Use row limits for large datasets
3. **Analyze First**: Use analysis functions before heavy processing
4. **Cache Results**: Memoize parsing results when possible

## Future Enhancements

- **Custom Column Types**: Support for custom column renderers
- **Advanced Filtering**: More sophisticated filter options
- **Export Functionality**: CSV/Excel export capabilities
- **Real-time Updates**: Live data synchronization
- **Accessibility**: Enhanced screen reader support

The enhanced response parser transforms simple markdown into rich, interactive experiences while maintaining excellent performance and reliability.
