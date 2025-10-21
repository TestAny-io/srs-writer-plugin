/**
 * Internet Search Tool Types
 *
 * Type definitions for the internet search tool and its strategies.
 */

/**
 * Search Request Parameters
 */
export interface SearchRequest {
  /** Search query string */
  query: string;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Type of search to perform */
  searchType?: 'general' | 'technical' | 'documentation';
}

/**
 * Unified Search Result Format
 * All strategies must return results in this format
 */
export interface SearchResult {
  /** Whether the search was successful */
  success: boolean;
  /** Structured search results (if available) */
  results?: SearchResultItem[];
  /** String-formatted search data (for display or fallback) */
  searchData?: string;
  /** Metadata about the search */
  metadata: {
    /** Which provider performed the search */
    provider: string;
    /** Which strategy was used */
    strategy: string;
    /** Timestamp of the search */
    timestamp: string;
    /** Whether result was served from cache */
    cached?: boolean;
    /** Search execution duration in milliseconds */
    duration?: number;
  };
  /** Error message (if unsuccessful) */
  error?: string;
}

/**
 * Individual Search Result Item
 */
export interface SearchResultItem {
  /** Result title */
  title: string;
  /** Result URL */
  url: string;
  /** Result snippet/description */
  snippet: string;
  /** Relevance score (optional) */
  relevance?: number;
}

/**
 * Search Strategy Interface
 * All search strategies must implement this interface
 */
export interface SearchStrategy {
  /** Human-readable strategy name */
  readonly name: string;
  /** Priority (lower number = higher priority) */
  readonly priority: number;

  /**
   * Check if this strategy is currently available
   * @returns true if strategy can be used, false otherwise
   */
  isAvailable(): Promise<boolean>;

  /**
   * Execute search using this strategy
   * @param request Search parameters
   * @returns Search results
   * @throws Error if search fails (will trigger fallback to next strategy)
   */
  execute(request: SearchRequest): Promise<SearchResult>;

  /**
   * Get current status/configuration of this strategy
   * @returns Status information for diagnostics
   */
  getStatus(): Promise<StrategyStatus>;
}

/**
 * Strategy Status Information
 * Used for diagnostics and user guidance
 */
export interface StrategyStatus {
  /** Whether strategy is available */
  available: boolean;
  /** Human-readable status message */
  message: string;
  /** Whether strategy requires setup */
  requiresSetup?: boolean;
  /** Setup instructions (if requiresSetup=true) */
  setupInstructions?: string;
}
