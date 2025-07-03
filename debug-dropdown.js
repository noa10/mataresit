// Debug script for mobile dropdown scrolling issues
// Run this in browser console after opening the dropdown

function debugDropdown() {
  console.log('🔍 Debugging Mobile Dropdown Scrolling...');
  
  // Find the dropdown elements
  const trigger = document.querySelector('[data-radix-dropdown-menu-trigger]');
  const content = document.querySelector('[data-radix-dropdown-menu-content]');
  const scrollArea = document.querySelector('[data-radix-scroll-area-root]');
  const viewport = document.querySelector('[data-radix-scroll-area-viewport]');
  
  console.log('📋 Element Detection:');
  console.log('- Trigger found:', !!trigger);
  console.log('- Content found:', !!content);
  console.log('- ScrollArea found:', !!scrollArea);
  console.log('- Viewport found:', !!viewport);
  
  if (content) {
    const contentRect = content.getBoundingClientRect();
    const contentStyle = getComputedStyle(content);
    
    console.log('📐 DropdownMenuContent Analysis:');
    console.log('- Dimensions:', {
      width: contentRect.width,
      height: contentRect.height,
      top: contentRect.top,
      bottom: contentRect.bottom
    });
    console.log('- Computed styles:', {
      maxHeight: contentStyle.maxHeight,
      height: contentStyle.height,
      overflow: contentStyle.overflow,
      overflowY: contentStyle.overflowY,
      position: contentStyle.position
    });
    console.log('- Scroll info:', {
      scrollHeight: content.scrollHeight,
      clientHeight: content.clientHeight,
      scrollTop: content.scrollTop,
      isScrollable: content.scrollHeight > content.clientHeight
    });
  }
  
  if (scrollArea) {
    const scrollAreaRect = scrollArea.getBoundingClientRect();
    const scrollAreaStyle = getComputedStyle(scrollArea);
    
    console.log('📐 ScrollArea Analysis:');
    console.log('- Dimensions:', {
      width: scrollAreaRect.width,
      height: scrollAreaRect.height,
      top: scrollAreaRect.top,
      bottom: scrollAreaRect.bottom
    });
    console.log('- Computed styles:', {
      maxHeight: scrollAreaStyle.maxHeight,
      height: scrollAreaStyle.height,
      overflow: scrollAreaStyle.overflow,
      overflowY: scrollAreaStyle.overflowY
    });
    console.log('- Scroll info:', {
      scrollHeight: scrollArea.scrollHeight,
      clientHeight: scrollArea.clientHeight,
      scrollTop: scrollArea.scrollTop,
      isScrollable: scrollArea.scrollHeight > scrollArea.clientHeight
    });
  }
  
  if (viewport) {
    const viewportRect = viewport.getBoundingClientRect();
    const viewportStyle = getComputedStyle(viewport);
    
    console.log('📐 Viewport Analysis:');
    console.log('- Dimensions:', {
      width: viewportRect.width,
      height: viewportRect.height,
      top: viewportRect.top,
      bottom: viewportRect.bottom
    });
    console.log('- Computed styles:', {
      maxHeight: viewportStyle.maxHeight,
      height: viewportStyle.height,
      overflow: viewportStyle.overflow,
      overflowY: viewportStyle.overflowY
    });
    console.log('- Scroll info:', {
      scrollHeight: viewport.scrollHeight,
      clientHeight: viewport.clientHeight,
      scrollTop: viewport.scrollTop,
      isScrollable: viewport.scrollHeight > viewport.clientHeight
    });
  }
  
  // Check viewport dimensions
  console.log('📱 Viewport Info:');
  console.log('- Window dimensions:', {
    width: window.innerWidth,
    height: window.innerHeight,
    '80vh': window.innerHeight * 0.8
  });
  
  // Check for CSS conflicts
  console.log('🔧 CSS Conflict Check:');
  const allElements = [content, scrollArea, viewport].filter(Boolean);
  allElements.forEach((el, index) => {
    const elementName = ['content', 'scrollArea', 'viewport'][index];
    const style = getComputedStyle(el);
    console.log(`- ${elementName} overflow properties:`, {
      overflow: style.overflow,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      overflowScrolling: style.webkitOverflowScrolling || style['-webkit-overflow-scrolling'],
      overscrollBehavior: style.overscrollBehavior
    });
  });
  
  // Test scrolling
  if (viewport) {
    console.log('🧪 Testing Scroll Functionality:');
    const originalScrollTop = viewport.scrollTop;
    viewport.scrollTop = 50;
    setTimeout(() => {
      const newScrollTop = viewport.scrollTop;
      console.log('- Scroll test result:', {
        original: originalScrollTop,
        attempted: 50,
        actual: newScrollTop,
        scrollWorking: newScrollTop !== originalScrollTop
      });
      viewport.scrollTop = originalScrollTop; // Reset
    }, 100);
  }
}

// Auto-run when dropdown is detected
function waitForDropdown() {
  const content = document.querySelector('[data-radix-dropdown-menu-content]');
  if (content) {
    debugDropdown();
  } else {
    console.log('⏳ Waiting for dropdown to open...');
    setTimeout(waitForDropdown, 1000);
  }
}

console.log('🚀 Dropdown Debug Script Loaded');
console.log('📝 Instructions:');
console.log('1. Open the user avatar dropdown menu');
console.log('2. Run debugDropdown() in console');
console.log('3. Or wait - script will auto-run when dropdown is detected');

waitForDropdown();
