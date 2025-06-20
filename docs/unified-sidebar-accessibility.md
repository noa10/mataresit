# Unified Sidebar Accessibility and Keyboard Shortcuts

## Overview

This document outlines the comprehensive accessibility features and keyboard shortcuts implemented for the unified sidebar system in Mataresit.

## Keyboard Shortcuts

### Global Shortcuts (All Routes)

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl/Cmd + B` | Toggle sidebar | Any route with sidebar |
| `Escape` | Close sidebar (mobile only) | Mobile devices when sidebar is open |

### Route-Specific Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `F6` | Cycle focus between navigation elements | Search/Chat page |
| `Tab` | Navigate within sidebar (focus trap) | Mobile sidebar when open |
| `Shift + Tab` | Navigate backwards within sidebar | Mobile sidebar when open |

## Accessibility Features

### ARIA Attributes

#### Sidebar Containers
- `role="navigation"` - Main navigation sidebar
- `role="complementary"` - Conversation sidebar
- `aria-label` - Descriptive labels for each sidebar type
- `aria-expanded` - Current open/closed state
- `aria-hidden` - Hidden state for screen readers

#### Toggle Buttons
- `aria-expanded` - Reflects sidebar open/closed state
- `aria-controls` - Links to controlled sidebar element
- `aria-label` - Descriptive action labels
- Dynamic `title` attributes with keyboard shortcuts

### Focus Management

#### Desktop Behavior
- Sidebar state persisted in localStorage
- Smooth focus transitions
- No focus trapping (allows natural tab flow)

#### Mobile Behavior
- **Auto-focus**: First interactive element when sidebar opens
- **Focus trap**: Tab navigation contained within sidebar
- **Focus return**: Returns to main content when sidebar closes
- **Escape handling**: Closes sidebar and returns focus

### Screen Reader Support

#### Live Announcements
- Sidebar state changes announced via `aria-live="polite"`
- Content type changes announced (navigation → conversation)
- Visual feedback for keyboard shortcuts

#### Semantic Structure
- Proper heading hierarchy within sidebars
- Landmark roles for navigation sections
- Descriptive labels for all interactive elements

## Mobile Swipe Gestures

### Swipe-to-Close
- **Trigger**: Horizontal swipe left > 50px
- **Feedback**: Visual feedback message
- **Accessibility**: Announced to screen readers
- **Performance**: Passive event listeners for smooth scrolling

### Touch Interaction
- **Start threshold**: 10px minimum movement
- **Direction detection**: Horizontal vs vertical movement
- **Gesture completion**: Automatic sidebar close on threshold

## Visual Feedback

### Keyboard Shortcut Feedback
- **Toast notifications** for keyboard actions
- **Positioning**: Top-right corner, non-intrusive
- **Duration**: 1.5 seconds with smooth animations
- **Accessibility**: `role="status"` and `aria-live="polite"`

### State Indicators
- **Toggle button icons** reflect current state
- **Hover animations** provide visual feedback
- **Focus rings** for keyboard navigation
- **Transition animations** for state changes

## Implementation Details

### AppSidebarContext Features
```typescript
// Enhanced keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Ctrl/Cmd + B: Toggle sidebar
    if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
      event.preventDefault();
      toggleSidebar();
      showKeyboardShortcutFeedback('Sidebar toggled');
    }
    
    // Escape: Close sidebar on mobile
    if (event.key === 'Escape' && isSidebarOpen && !isDesktop) {
      event.preventDefault();
      toggleSidebar();
      // Return focus to main content
    }
  };
}, [toggleSidebar, isSidebarOpen, isDesktop]);
```

### useSidebarAccessibility Hook
```typescript
// Comprehensive accessibility management
const { sidebarProps } = useSidebarAccessibility({
  sidebarId: 'main-navigation-sidebar',
  autoFocus: true,
  trapFocus: true,
  announceStateChanges: true
});
```

## Testing Guidelines

### Keyboard Navigation Tests
1. **Tab through all interactive elements** in sidebar
2. **Verify focus trap** works on mobile
3. **Test keyboard shortcuts** across all routes
4. **Confirm focus return** after sidebar closes

### Screen Reader Tests
1. **Verify announcements** for state changes
2. **Test landmark navigation** with screen readers
3. **Confirm proper labeling** of all elements
4. **Validate ARIA attributes** are correct

### Mobile Accessibility Tests
1. **Test swipe gestures** with assistive touch
2. **Verify focus management** on touch devices
3. **Confirm escape key** works with external keyboards
4. **Test with VoiceOver/TalkBack** enabled

## Browser Compatibility

### Supported Features
- **Modern browsers**: Full feature support
- **Keyboard shortcuts**: All major browsers
- **Touch gestures**: Mobile browsers with touch support
- **ARIA attributes**: All browsers with accessibility APIs

### Fallbacks
- **No JavaScript**: Sidebar remains accessible via CSS
- **No touch support**: Keyboard and mouse navigation available
- **Older browsers**: Basic functionality maintained

## Performance Considerations

### Event Listeners
- **Passive listeners** for touch events
- **Debounced resize** handlers
- **Cleanup on unmount** prevents memory leaks

### Animations
- **CSS transitions** for smooth performance
- **Reduced motion** support via `prefers-reduced-motion`
- **Hardware acceleration** for transform animations

## Future Enhancements

### Planned Improvements
1. **Customizable shortcuts** - User-configurable key bindings
2. **Voice commands** - Integration with speech recognition
3. **Gesture customization** - Configurable swipe thresholds
4. **High contrast mode** - Enhanced visual accessibility

### Accessibility Roadmap
1. **WCAG 2.2 compliance** - Full AA level compliance
2. **Advanced screen reader** support
3. **Cognitive accessibility** features
4. **Motor impairment** accommodations

## Conclusion

The unified sidebar system provides comprehensive accessibility features that ensure all users can effectively navigate and interact with the application, regardless of their abilities or preferred interaction methods.
