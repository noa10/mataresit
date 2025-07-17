// Content extractors for different data sources
// Phase 4: Embedding Generation System Enhancement

// Import content synthesis utilities
import {
  synthesizeReceiptContent,
  validateAndEnhanceContent,
  ContentExtractionStrategy
} from '../_shared/content-synthesis.ts';

export interface ContentExtractionResult {
  contentType: string;
  contentText: string;
  metadata: Record<string, any>;
  userId?: string;
  teamId?: string;
  language?: string;
}

export class ContentExtractor {
  /**
   * Extract content from receipts with enhanced validation
   */
  static async extractReceiptContent(receipt: any): Promise<ContentExtractionResult[]> {
    const results: ContentExtractionResult[] = [];

    console.log(`🔍 Extracting content from receipt ${receipt.id}:`, {
      merchant: receipt.merchant ? `"${receipt.merchant}"` : 'missing',
      fullText: receipt.fullText ? `${receipt.fullText.length} chars` : 'missing',
      hasUserId: !!receipt.user_id
    });

    // Generate synthetic content from structured data if fullText is missing
    let contentStrategy: ContentExtractionStrategy | null = null;

    if (!receipt.fullText || receipt.fullText.trim().length === 0) {
      console.log(`🔄 Generating synthetic content for receipt ${receipt.id} (missing fullText)`);
      contentStrategy = synthesizeReceiptContent(receipt);
      contentStrategy = validateAndEnhanceContent(contentStrategy, receipt);
    }

    // Extract merchant name (primary content)
    if (receipt.merchant && receipt.merchant.trim()) {
      const merchantText = receipt.merchant.trim();
      console.log(`✅ Extracted merchant: "${merchantText}"`);

      results.push({
        contentType: 'merchant',
        contentText: merchantText,
        metadata: {
          receipt_date: receipt.date,
          total: receipt.total,
          currency: receipt.currency,
          merchant_length: merchantText.length
        },
        userId: receipt.user_id,
        teamId: receipt.team_id,
        language: 'en'
      });
    } else {
      console.warn(`⚠️ No merchant name found for receipt ${receipt.id}`);
    }

    // Extract full text - use synthetic if original is missing
    const fullTextContent = receipt.fullText?.trim() || contentStrategy?.synthetic_fulltext || '';
    if (fullTextContent) {
      console.log(`✅ Extracted full text: ${fullTextContent.length} characters ${contentStrategy ? '(synthetic)' : '(original)'}`);

      results.push({
        contentType: 'full_text',
        contentText: fullTextContent,
        metadata: {
          receipt_date: receipt.date,
          total: receipt.total,
          merchant: receipt.merchant,
          currency: receipt.currency,
          fulltext_length: fullTextContent.length,
          is_synthetic: !!contentStrategy
        },
        userId: receipt.user_id,
        teamId: receipt.team_id,
        language: 'en'
      });
    } else {
      console.warn(`⚠️ No full text found for receipt ${receipt.id}`);
    }

    // Add enhanced content types if synthetic content was generated
    if (contentStrategy) {
      console.log(`🔄 Adding enhanced content types for receipt ${receipt.id}`);

      // Add items description if available
      if (contentStrategy.items_description && contentStrategy.items_description.trim()) {
        results.push({
          contentType: 'items_description',
          contentText: contentStrategy.items_description,
          metadata: {
            receipt_date: receipt.date,
            total: receipt.total,
            merchant: receipt.merchant,
            currency: receipt.currency,
            content_source: 'ai_vision_line_items'
          },
          userId: receipt.user_id,
          teamId: receipt.team_id,
          language: 'en'
        });
      }

      // Add transaction summary
      if (contentStrategy.transaction_summary && contentStrategy.transaction_summary.trim()) {
        results.push({
          contentType: 'transaction_summary',
          contentText: contentStrategy.transaction_summary,
          metadata: {
            receipt_date: receipt.date,
            total: receipt.total,
            merchant: receipt.merchant,
            currency: receipt.currency,
            content_source: 'ai_vision_transaction'
          },
          userId: receipt.user_id,
          teamId: receipt.team_id,
          language: 'en'
        });
      }

      // Add category context
      if (contentStrategy.category_context && contentStrategy.category_context.trim()) {
        results.push({
          contentType: 'category_context',
          contentText: contentStrategy.category_context,
          metadata: {
            receipt_date: receipt.date,
            total: receipt.total,
            merchant: receipt.merchant,
            currency: receipt.currency,
            predicted_category: receipt.predicted_category,
            content_source: 'ai_vision_category'
          },
          userId: receipt.user_id,
          teamId: receipt.team_id,
          language: 'en'
        });
      }
    }

    // Create fallback content if no primary content available
    if (results.length === 0) {
      console.warn(`⚠️ No primary content found for receipt ${receipt.id}, creating fallback`);

      const fallbackParts = [
        receipt.merchant ? `Merchant: ${receipt.merchant}` : '',
        receipt.date ? `Date: ${receipt.date}` : '',
        receipt.total ? `Total: ${receipt.total}` : '',
        receipt.payment_method ? `Payment: ${receipt.payment_method}` : '',
        receipt.predicted_category ? `Category: ${receipt.predicted_category}` : ''
      ].filter(Boolean);

      const fallbackText = fallbackParts.join('\n');

      if (fallbackText.trim()) {
        console.log(`✅ Created fallback content: "${fallbackText}"`);

        results.push({
          contentType: 'fallback',
          contentText: fallbackText,
          metadata: {
            receipt_date: receipt.date,
            total: receipt.total,
            is_fallback: true,
            fallback_parts: fallbackParts.length
          },
          userId: receipt.user_id,
          teamId: receipt.team_id,
          language: 'en'
        });
      } else {
        console.error(`❌ No embeddable content found for receipt ${receipt.id}`);
        throw new Error(`Receipt ${receipt.id} has no embeddable content`);
      }
    }

    console.log(`📊 Extracted ${results.length} content pieces from receipt ${receipt.id}`);
    return results;
  }

  /**
   * Extract content from claims
   */
  static async extractClaimContent(claim: any): Promise<ContentExtractionResult[]> {
    const results: ContentExtractionResult[] = [];

    // Extract title
    if (claim.title) {
      results.push({
        contentType: 'title',
        contentText: claim.title,
        metadata: {
          amount: claim.amount,
          currency: claim.currency,
          category: claim.category,
          priority: claim.priority,
          status: claim.status
        },
        userId: claim.claimant_id,
        teamId: claim.team_id,
        language: 'en'
      });
    }

    // Extract description
    if (claim.description) {
      results.push({
        contentType: 'description',
        contentText: claim.description,
        metadata: {
          title: claim.title,
          amount: claim.amount,
          currency: claim.currency,
          category: claim.category,
          priority: claim.priority,
          status: claim.status
        },
        userId: claim.claimant_id,
        teamId: claim.team_id,
        language: 'en'
      });
    }

    // Extract attachments metadata if available
    if (claim.attachments && Array.isArray(claim.attachments) && claim.attachments.length > 0) {
      const attachmentText = claim.attachments
        .map((att: any) => att.name || att.filename || '')
        .filter(Boolean)
        .join(' ');

      if (attachmentText) {
        results.push({
          contentType: 'attachments',
          contentText: attachmentText,
          metadata: {
            title: claim.title,
            attachment_count: claim.attachments.length,
            amount: claim.amount,
            currency: claim.currency
          },
          userId: claim.claimant_id,
          teamId: claim.team_id,
          language: 'en'
        });
      }
    }

    return results;
  }

  /**
   * Extract content from team members
   */
  static async extractTeamMemberContent(teamMember: any, profile: any): Promise<ContentExtractionResult[]> {
    const results: ContentExtractionResult[] = [];

    // Create profile content combining available information
    const profileParts = [
      profile?.first_name || '',
      profile?.last_name || '',
      profile?.email || '',
      teamMember.role || ''
    ].filter(Boolean);

    if (profileParts.length > 0) {
      results.push({
        contentType: 'profile',
        contentText: profileParts.join(' '),
        metadata: {
          role: teamMember.role,
          email: profile?.email,
          first_name: profile?.first_name,
          last_name: profile?.last_name,
          joined_at: teamMember.joined_at
        },
        userId: teamMember.user_id,
        teamId: teamMember.team_id,
        language: 'en'
      });
    }

    return results;
  }

  /**
   * Extract content from custom categories
   */
  static async extractCustomCategoryContent(category: any): Promise<ContentExtractionResult[]> {
    const results: ContentExtractionResult[] = [];

    // Extract category name and metadata
    if (category.name) {
      results.push({
        contentType: 'name',
        contentText: category.name,
        metadata: {
          color: category.color,
          icon: category.icon,
          created_at: category.created_at
        },
        userId: category.user_id,
        language: 'en'
      });
    }

    return results;
  }

  /**
   * Extract content from Malaysian business directory
   */
  static async extractBusinessDirectoryContent(business: any): Promise<ContentExtractionResult[]> {
    const results: ContentExtractionResult[] = [];

    // Extract business name (English)
    if (business.business_name) {
      results.push({
        contentType: 'business_name',
        contentText: business.business_name,
        metadata: {
          business_type: business.business_type,
          registration_number: business.registration_number,
          city: business.city,
          state: business.state,
          industry_category: business.industry_category,
          is_chain: business.is_chain
        },
        language: 'en'
      });
    }

    // Extract business name (Malay) if available
    if (business.business_name_malay) {
      results.push({
        contentType: 'business_name_malay',
        contentText: business.business_name_malay,
        metadata: {
          business_type: business.business_type,
          registration_number: business.registration_number,
          city: business.city,
          state: business.state,
          industry_category: business.industry_category,
          is_chain: business.is_chain
        },
        language: 'ms'
      });
    }

    // Extract keywords if available
    if (business.keywords && Array.isArray(business.keywords) && business.keywords.length > 0) {
      results.push({
        contentType: 'keywords',
        contentText: business.keywords.join(' '),
        metadata: {
          business_name: business.business_name,
          business_type: business.business_type,
          city: business.city,
          state: business.state,
          keyword_count: business.keywords.length
        },
        language: 'en'
      });
    }

    // Extract address information
    const addressParts = [
      business.address_line1,
      business.address_line2,
      business.city,
      business.state,
      business.postcode
    ].filter(Boolean);

    if (addressParts.length > 0) {
      results.push({
        contentType: 'address',
        contentText: addressParts.join(' '),
        metadata: {
          business_name: business.business_name,
          city: business.city,
          state: business.state,
          postcode: business.postcode
        },
        language: 'en'
      });
    }

    return results;
  }
}
