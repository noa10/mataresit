/**
 * Markdown Loader Service
 * 
 * This service loads markdown content from the docs/user-guides directory
 * and provides it to the documentation system.
 */

export interface MarkdownContent {
  content: string;
  frontmatter?: Record<string, any>;
  lastModified?: Date;
}

class MarkdownLoader {
  private cache = new Map<string, MarkdownContent>();
  private baseUrl = '/docs/user-guides';

  /**
   * Load markdown content from a file path
   */
  async loadMarkdown(path: string): Promise<MarkdownContent> {
    // Check cache first
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }

    try {
      // In development, we can try to load from the public directory
      // In production, this would need to be pre-built or served from an API
      const response = await fetch(path);
      
      if (!response.ok) {
        throw new Error(`Failed to load markdown: ${response.status} ${response.statusText}`);
      }

      const content = await response.text();
      const markdownContent: MarkdownContent = {
        content,
        lastModified: new Date()
      };

      // Cache the content
      this.cache.set(path, markdownContent);
      
      return markdownContent;
    } catch (error) {
      console.error(`Failed to load markdown from ${path}:`, error);
      
      // Return fallback content that references our comprehensive guides
      const fallbackContent: MarkdownContent = {
        content: this.generateFallbackContent(path),
        lastModified: new Date()
      };
      
      return fallbackContent;
    }
  }

  /**
   * Generate fallback content that explains the guide structure
   */
  private generateFallbackContent(path: string): string {
    const guideName = path.split('/').pop()?.replace('.md', '') || 'guide';
    const category = path.includes('/onboarding/') ? 'Getting Started' :
                    path.includes('/core-features/') ? 'Core Features' :
                    path.includes('/ai-intelligence/') ? 'AI & Intelligence' :
                    path.includes('/team-collaboration/') ? 'Team Collaboration' : 'Documentation';

    return `# ${this.formatTitle(guideName)}

## 📚 Comprehensive User Guide

This guide is part of Mataresit's comprehensive user documentation system, located in the **${category}** category.

### 🎯 What This Guide Covers

This ${guideName.replace(/-/g, ' ')} guide provides detailed information about:

- Step-by-step instructions
- Best practices and tips
- Common troubleshooting solutions
- Advanced configuration options
- Real-world examples and use cases

### 📖 Guide Structure

Our user guides are organized into four main categories:

#### 🚀 Getting Started
- **5-Minute Quick Start** - Get up and running immediately
- **New User Onboarding** - Complete setup walkthrough
- **Account Setup** - Account configuration and verification
- **Dashboard Navigation** - Learn the interface

#### 🔧 Core Features
- **AI Vision Processing** - Smart receipt processing
- **Batch Processing** - Upload multiple receipts efficiently
- **Semantic Search** - Advanced search capabilities
- **Export & Reporting** - Generate reports and export data
- **Platform Features** - PWA, mobile, and cross-platform features

#### 🤖 AI & Intelligence
- **Advanced Analytics** - Business intelligence and insights
- **Malaysian Business Intelligence** - Local business recognition
- **Personalization Features** - Customize your experience
- **Real-time Notifications** - Smart alerts and updates

#### 👥 Team Collaboration
- **Team Setup** - Create and manage teams
- **Role & Permissions** - Access control management
- **Claims Management** - Expense workflows and approvals
- **Team Analytics** - Performance insights and metrics

### 🔍 Finding More Information

For the complete, up-to-date version of this guide:

1. **Check the Documentation Repository**: The full guide is available in the \`docs/user-guides/\` directory
2. **Browse by Category**: Navigate through the organized category structure
3. **Use Search**: Find specific topics using the documentation search
4. **Follow Cross-References**: Related guides are linked throughout the documentation

### 📝 Guide Content

*The complete content for this guide includes:*

- **Detailed Instructions**: Step-by-step procedures with screenshots
- **Configuration Examples**: Real configuration examples and code snippets
- **Troubleshooting**: Common issues and their solutions
- **Best Practices**: Recommended approaches and optimization tips
- **Advanced Topics**: In-depth coverage for power users

### 🎯 Next Steps

After reading this guide, you might want to explore:

- **Related Guides**: Other guides in the ${category} category
- **Quick Start Guides**: Fast-track guides for immediate results
- **Advanced Features**: Power user capabilities and customization
- **Team Features**: Collaboration and multi-user functionality

### 📞 Getting Help

If you need additional assistance:

1. **Search the Documentation**: Use the search feature to find specific topics
2. **Check Related Guides**: Browse similar guides in the same category
3. **Contact Support**: Reach out through the application's help system
4. **Community Resources**: Join discussions and share experiences

---

**Note**: This is a placeholder for the comprehensive user guide. The complete documentation with detailed instructions, screenshots, and examples is available in the Mataresit documentation system.

**Last Updated**: ${new Date().toLocaleDateString()}  
**Category**: ${category}  
**Guide Path**: \`${path}\``;
  }

  /**
   * Format title from filename
   */
  private formatTitle(filename: string): string {
    return filename
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Preload common guides
   */
  async preloadCommonGuides(): Promise<void> {
    const commonGuides = [
      '/docs/user-guides/en/onboarding/quick-start-5min.md',
      '/docs/user-guides/en/onboarding/new-user-guide.md',
      '/docs/user-guides/en/core-features/ai-vision-processing.md',
      '/docs/user-guides/en/team-collaboration/team-setup.md'
    ];

    const loadPromises = commonGuides.map(path => 
      this.loadMarkdown(path).catch(error => 
        console.warn(`Failed to preload ${path}:`, error)
      )
    );

    await Promise.allSettled(loadPromises);
  }
}

export const markdownLoader = new MarkdownLoader();
