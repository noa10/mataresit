# Enhanced Prompt Engineering Documentation

This document outlines the comprehensive formatting instructions and prompt engineering improvements implemented in the Mataresit chatbot system to generate better structured, more readable responses.

## Overview

The enhanced prompt engineering system provides detailed formatting instructions to the LLM to ensure consistent, professional, and user-friendly responses across all interaction types.

## Core Formatting Requirements

### Content Structure
- **Hierarchical Headers**: Use markdown headers (# ## ###) to organize content
- **Introductory Context**: Always include brief introductory sentences
- **Logical Flow**: Structure responses from summary to details
- **Clear Sections**: Separate different types of information

### Table Formatting Standards

#### Receipt Data Table Format
```markdown
| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |
| TESCO EXTRA | 16/01/2024 | MYR 45.60 | Weekly groceries |
```

#### Financial Analysis Table Format
```markdown
| Date | Merchant | Category | Amount | Notes |
|------|----------|----------|--------|-------|
| 15/01/2024 | SUPER SEVEN | Groceries | MYR 17.90 | POWERCAT 1.3KG |
| 16/01/2024 | TESCO EXTRA | Groceries | MYR 45.60 | Weekly shopping |
```

### Financial Data Formatting

#### Currency Format
- **Standard**: "MYR 25.50" (space between currency and amount)
- **Large Numbers**: "MYR 1,234.56" (commas for thousands)
- **Totals**: "**Total: MYR 245.30**" (bold formatting)
- **Averages**: "Average: MYR 35.04 per receipt"

#### Percentage Format
- **Increases**: "+15.2%"
- **Decreases**: "-8.7%"
- **Neutral**: "0.0%"

### Date Formatting
- **Standard**: DD/MM/YYYY (e.g., 15/01/2024)
- **Date Ranges**: "15/01/2024 - 20/01/2024"
- **Relative Dates**: "3 days ago (15/01/2024)"

## Enhanced Prompt Templates

### 1. Conversational Template
**Purpose**: Quick, friendly responses for general queries
**Key Features**:
- Concise, scannable format
- Direct confirmation of findings
- Simple question at the end
- Appropriate formatting based on result count

**Example Output**:
```
I found 7 receipts matching "powercat", all from SUPER SEVEN CASH & CARRY for POWERCAT 1.3KG at MYR 17.90 each. Total: **MYR 125.30**. What would you like to do?
```

### 2. Document Retrieval Template
**Purpose**: Comprehensive search results presentation
**Structure**:
1. # Search Results Summary
2. ## Receipt Details (table format)
3. ## Key Statistics
4. ## Suggested Actions

**Example Output**:
```markdown
# Search Results for "POWERCAT"

Found **7 receipts** matching your search criteria.

## Receipt Details
| Merchant | Date | Amount | Description |
|----------|------|--------|-------------|
| SUPER SEVEN CASH & CARRY | 15/01/2024 | MYR 17.90 | POWERCAT 1.3KG |

## Key Statistics
• **Total Amount**: MYR 125.30
• **Date Range**: 15/01/2024 - 22/01/2024
• **Merchants**: 1 (SUPER SEVEN CASH & CARRY)
```

### 3. Financial Analysis Template
**Purpose**: Detailed financial insights and trends
**Structure**:
1. # Financial Analysis Summary
2. ## Spending Overview
3. ## Transaction Breakdown
4. ## Insights & Trends
5. ## Recommendations

**Key Features**:
- Comprehensive summary statistics
- Detailed transaction tables
- Trend analysis with percentages
- Actionable recommendations

### 4. Temporal Templates
**Purpose**: Handle date-based queries and empty results
**Features**:
- Clear date range acknowledgment
- Helpful alternative suggestions
- Solution-oriented approach
- Proper date formatting

### 5. Receipt Formatting Template
**Purpose**: Specialized receipt data presentation
**Formats**:
- **Single Receipt**: Inline format with key details
- **Similar Receipts**: Grouped format with totals
- **Different Receipts**: Table format with summary

## Formatting Rules Enforcement

### Critical Rules
1. **No Template Placeholders**: Never use {{date}} or {{amount}}
2. **Actual Data Only**: Always use real data from search results
3. **Consistent Formatting**: Maintain format throughout response
4. **Proper Markdown**: Use correct markdown syntax
5. **Table Structure**: Ensure proper | separators

### Mobile-Friendly Considerations
- **Concise Columns**: Keep table columns informative but not too wide
- **Line Breaks**: Use proper spacing for readability
- **Abbreviations**: Use when necessary (e.g., "Desc." for Description)
- **Maximum Columns**: Limit to 4-5 columns for mobile compatibility

## Summary Statistics Format

### Standard Summary Structure
```markdown
## Summary
• **Total Receipts**: 7 items
• **Total Amount**: MYR 125.30
• **Date Range**: 15/01/2024 - 20/01/2024
• **Top Merchant**: SUPER SEVEN (5 receipts)
• **Average per Receipt**: MYR 17.90
```

### Financial Analysis Summary
```markdown
## Spending Overview
• **Total Spent**: MYR 245.30
• **Number of Transactions**: 12 receipts
• **Date Range**: 15/01/2024 - 28/01/2024
• **Average per Transaction**: MYR 20.44
• **Top Category**: Groceries (67% of spending)
• **Most Frequent Merchant**: SUPER SEVEN (5 transactions)
```

## Implementation Benefits

### User Experience Improvements
- **Better Readability**: Structured content with clear hierarchy
- **Scannable Information**: Easy to find key details quickly
- **Professional Appearance**: Consistent, polished formatting
- **Mobile Optimization**: Responsive design considerations

### Technical Benefits
- **Consistent Output**: Standardized formatting across all responses
- **Parser Compatibility**: Optimized for markdown-to-UI conversion
- **Maintainable**: Clear guidelines for future updates
- **Scalable**: Templates can be extended for new use cases

## Quality Assurance

### Validation Checks
- Currency format validation (MYR X.XX)
- Date format validation (DD/MM/YYYY)
- Table structure validation (proper | separators)
- Header hierarchy validation (# ## ###)
- No template placeholder validation

### Testing Scenarios
- Single receipt responses
- Multiple similar receipts
- Multiple different receipts
- Empty result sets
- Large result sets (>20 items)
- Financial analysis queries
- Temporal queries

## Future Enhancements

### Planned Improvements
- **Dynamic Formatting**: Adjust based on user preferences
- **Localization**: Support for different date/currency formats
- **Advanced Tables**: More sophisticated table structures
- **Interactive Elements**: Enhanced UI component integration
- **Performance Optimization**: Faster response generation

The enhanced prompt engineering system ensures that all chatbot responses are well-formatted, consistent, and user-friendly, providing a professional experience that makes financial data easy to understand and act upon.
