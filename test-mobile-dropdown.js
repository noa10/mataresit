/**
 * Mobile Dropdown Scrolling Test Script
 * 
 * Run this script in the browser console to test the mobile dropdown functionality.
 * Make sure you're on a page with the user avatar dropdown (e.g., /search, /dashboard).
 */

class MobileDropdownTester {
  constructor() {
    this.results = [];
    this.isTestRunning = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    
    console.log(`%c${logMessage}`, this.getLogStyle(type));
    this.results.push({ timestamp, message, type });
  }

  getLogStyle(type) {
    const styles = {
      info: 'color: #2196F3;',
      success: 'color: #4CAF50; font-weight: bold;',
      warning: 'color: #FF9800; font-weight: bold;',
      error: 'color: #F44336; font-weight: bold;',
      test: 'color: #9C27B0; font-weight: bold;'
    };
    return styles[type] || styles.info;
  }

  async runAllTests() {
    if (this.isTestRunning) {
      this.log('Test already running...', 'warning');
      return;
    }

    this.isTestRunning = true;
    this.results = [];
    
    this.log('🚀 Starting Mobile Dropdown Scrolling Tests', 'test');
    
    try {
      await this.testDropdownExists();
      await this.testDropdownOpening();
      await this.testScrollingFunctionality();
      await this.testChatHistorySection();
      await this.testResponsiveConstraints();
      await this.testTouchScrolling();
      
      this.log('✅ All tests completed!', 'success');
      this.generateReport();
    } catch (error) {
      this.log(`❌ Test failed: ${error.message}`, 'error');
    } finally {
      this.isTestRunning = false;
    }
  }

  async testDropdownExists() {
    this.log('🔍 Testing dropdown existence...', 'test');
    
    const avatarButton = document.querySelector('[data-radix-dropdown-menu-trigger]');
    if (!avatarButton) {
      throw new Error('Avatar dropdown trigger not found');
    }
    
    this.log('✓ Avatar dropdown trigger found', 'success');
  }

  async testDropdownOpening() {
    this.log('🔍 Testing dropdown opening...', 'test');
    
    const trigger = document.querySelector('[data-radix-dropdown-menu-trigger]');
    
    // Click to open dropdown
    trigger.click();
    
    // Wait for dropdown to appear
    await this.wait(500);
    
    const dropdown = document.querySelector('[data-radix-dropdown-menu-content]');
    if (!dropdown) {
      throw new Error('Dropdown content not found after clicking trigger');
    }
    
    this.log('✓ Dropdown opens successfully', 'success');
    return dropdown;
  }

  async testScrollingFunctionality() {
    this.log('🔍 Testing scrolling functionality...', 'test');
    
    const dropdown = document.querySelector('[data-radix-dropdown-menu-content]');
    if (!dropdown) {
      throw new Error('Dropdown not open');
    }

    const scrollArea = dropdown.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollArea) {
      this.log('⚠️ ScrollArea not found - checking if dropdown is scrollable directly', 'warning');
    }

    const scrollableElement = scrollArea || dropdown;
    
    // Check if content is scrollable
    const isScrollable = scrollableElement.scrollHeight > scrollableElement.clientHeight;
    
    if (isScrollable) {
      this.log('✓ Dropdown content is scrollable', 'success');
      
      // Test scrolling
      const originalScrollTop = scrollableElement.scrollTop;
      scrollableElement.scrollTop = 50;
      
      await this.wait(100);
      
      if (scrollableElement.scrollTop !== originalScrollTop) {
        this.log('✓ Scrolling works correctly', 'success');
      } else {
        this.log('⚠️ Scrolling may not be working properly', 'warning');
      }
      
      // Reset scroll position
      scrollableElement.scrollTop = originalScrollTop;
    } else {
      this.log('ℹ️ Dropdown content fits without scrolling', 'info');
    }
  }

  async testChatHistorySection() {
    this.log('🔍 Testing Chat History section...', 'test');
    
    const chatHistorySection = document.querySelector('.compact-chat-history, [class*="CompactChatHistory"]');
    
    if (chatHistorySection) {
      this.log('✓ Chat History section found', 'success');
      
      const chatScrollArea = chatHistorySection.querySelector('[data-radix-scroll-area-viewport]');
      if (chatScrollArea) {
        this.log('✓ Chat History has its own scroll area', 'success');
      } else {
        this.log('⚠️ Chat History scroll area not found', 'warning');
      }
    } else {
      this.log('ℹ️ Chat History section not present (may not be on search page)', 'info');
    }
  }

  async testResponsiveConstraints() {
    this.log('🔍 Testing responsive constraints...', 'test');
    
    const dropdown = document.querySelector('[data-radix-dropdown-menu-content]');
    if (!dropdown) {
      throw new Error('Dropdown not open');
    }

    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const maxAllowedHeight = viewportHeight * 0.8; // 80vh

    this.log(`Dropdown height: ${dropdownRect.height}px`, 'info');
    this.log(`Viewport height: ${viewportHeight}px`, 'info');
    this.log(`Max allowed height (80vh): ${maxAllowedHeight}px`, 'info');

    if (dropdownRect.height <= maxAllowedHeight + 10) { // Allow small margin for rounding
      this.log('✓ Dropdown respects max height constraint', 'success');
    } else {
      this.log('⚠️ Dropdown exceeds max height constraint', 'warning');
    }

    // Check if dropdown is within viewport
    if (dropdownRect.bottom <= viewportHeight) {
      this.log('✓ Dropdown fits within viewport', 'success');
    } else {
      this.log('⚠️ Dropdown extends beyond viewport', 'warning');
    }
  }

  async testTouchScrolling() {
    this.log('🔍 Testing touch scrolling properties...', 'test');
    
    const dropdown = document.querySelector('[data-radix-dropdown-menu-content]');
    const scrollArea = dropdown?.querySelector('[data-radix-scroll-area-viewport]');
    const scrollableElement = scrollArea || dropdown;

    if (!scrollableElement) {
      throw new Error('No scrollable element found');
    }

    const computedStyle = getComputedStyle(scrollableElement);
    
    // Check for iOS momentum scrolling
    const webkitOverflowScrolling = computedStyle.webkitOverflowScrolling || computedStyle['-webkit-overflow-scrolling'];
    if (webkitOverflowScrolling === 'touch') {
      this.log('✓ iOS momentum scrolling enabled', 'success');
    } else {
      this.log('⚠️ iOS momentum scrolling not detected', 'warning');
    }

    // Check for overscroll behavior
    const overscrollBehavior = computedStyle.overscrollBehavior;
    if (overscrollBehavior === 'contain') {
      this.log('✓ Overscroll behavior set to contain', 'success');
    } else {
      this.log('⚠️ Overscroll behavior not optimized', 'warning');
    }
  }

  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateReport() {
    this.log('📊 Generating test report...', 'test');
    
    const successCount = this.results.filter(r => r.type === 'success').length;
    const warningCount = this.results.filter(r => r.type === 'warning').length;
    const errorCount = this.results.filter(r => r.type === 'error').length;
    
    console.group('📋 Test Report Summary');
    console.log(`✅ Successes: ${successCount}`);
    console.log(`⚠️ Warnings: ${warningCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.groupEnd();

    if (warningCount > 0 || errorCount > 0) {
      console.group('🔍 Issues Found');
      this.results
        .filter(r => r.type === 'warning' || r.type === 'error')
        .forEach(result => {
          console.log(`${result.type === 'error' ? '❌' : '⚠️'} ${result.message}`);
        });
      console.groupEnd();
    }

    // Store results for later access
    window.lastDropdownTestResults = this.results;
    this.log('Results stored in window.lastDropdownTestResults', 'info');
  }

  // Utility methods for manual testing
  getDropdownInfo() {
    const dropdown = document.querySelector('[data-radix-dropdown-menu-content]');
    if (!dropdown) {
      console.log('Dropdown not found or not open');
      return null;
    }

    const rect = dropdown.getBoundingClientRect();
    const style = getComputedStyle(dropdown);
    
    return {
      dimensions: {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom
      },
      styles: {
        maxHeight: style.maxHeight,
        overflow: style.overflow,
        overflowY: style.overflowY
      },
      scrollInfo: {
        scrollHeight: dropdown.scrollHeight,
        clientHeight: dropdown.clientHeight,
        isScrollable: dropdown.scrollHeight > dropdown.clientHeight
      }
    };
  }

  simulateDeviceSizes() {
    const sizes = [
      { name: 'iPhone SE', width: 320, height: 568 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'iPad Portrait', width: 768, height: 1024 },
      { name: 'iPad Landscape', width: 1024, height: 768 }
    ];

    console.group('📱 Device Size Simulation');
    console.log('Use these sizes in browser dev tools:');
    sizes.forEach(size => {
      console.log(`${size.name}: ${size.width}×${size.height}`);
    });
    console.groupEnd();
  }
}

// Create global instance
window.mobileDropdownTester = new MobileDropdownTester();

// Convenience methods
window.testMobileDropdown = () => window.mobileDropdownTester.runAllTests();
window.getDropdownInfo = () => window.mobileDropdownTester.getDropdownInfo();
window.showDeviceSizes = () => window.mobileDropdownTester.simulateDeviceSizes();

// Auto-run instructions
console.log('%c🧪 Mobile Dropdown Test Script Loaded!', 'color: #4CAF50; font-size: 16px; font-weight: bold;');
console.log('%cRun testMobileDropdown() to start testing', 'color: #2196F3; font-size: 14px;');
console.log('%cOther available commands:', 'color: #666; font-size: 12px;');
console.log('%c- getDropdownInfo() - Get current dropdown information', 'color: #666; font-size: 12px;');
console.log('%c- showDeviceSizes() - Show recommended device sizes for testing', 'color: #666; font-size: 12px;');
