/**
 * API Configuration Manager
 *
 * Manages API keys and provider settings from VS Code configuration.
 * Supports multiple providers with graceful degradation.
 */

import * as vscode from 'vscode';
import { Logger } from '../../../../utils/logger';

export interface ProviderConfig {
  name: string;
  enabled: boolean;
  apiKey?: string;
  secretKey?: string; // For providers like Baidu that need multiple keys
}

export class APIConfigManager {
  private static instance: APIConfigManager;
  private logger = Logger.getInstance();

  private constructor() {}

  static getInstance(): APIConfigManager {
    if (!APIConfigManager.instance) {
      APIConfigManager.instance = new APIConfigManager();
    }
    return APIConfigManager.instance;
  }

  /**
   * Get Tavily API configuration
   */
  getTavilyConfig(): ProviderConfig | null {
    const config = vscode.workspace.getConfiguration('srsWriter.internetSearch');
    const apiKey = config.get<string>('tavilyApiKey');

    if (!apiKey || apiKey.trim() === '') {
      return null;
    }

    return {
      name: 'tavily',
      enabled: true,
      apiKey: apiKey.trim()
    };
  }

  /**
   * Get Bing API configuration
   */
  getBingConfig(): ProviderConfig | null {
    const config = vscode.workspace.getConfiguration('srsWriter.internetSearch');
    const apiKey = config.get<string>('bingApiKey');

    if (!apiKey || apiKey.trim() === '') {
      return null;
    }

    return {
      name: 'bing',
      enabled: true,
      apiKey: apiKey.trim()
    };
  }

  /**
   * Get Baidu API configuration
   */
  getBaiduConfig(): ProviderConfig | null {
    const config = vscode.workspace.getConfiguration('srsWriter.internetSearch');
    const apiKey = config.get<string>('baiduApiKey');
    const secretKey = config.get<string>('baiduSecretKey');

    if (!apiKey || apiKey.trim() === '' || !secretKey || secretKey.trim() === '') {
      return null;
    }

    return {
      name: 'baidu',
      enabled: true,
      apiKey: apiKey.trim(),
      secretKey: secretKey.trim()
    };
  }

  /**
   * Get all configured providers
   */
  getAllConfiguredProviders(): ProviderConfig[] {
    const providers: ProviderConfig[] = [];

    const tavily = this.getTavilyConfig();
    if (tavily) providers.push(tavily);

    const bing = this.getBingConfig();
    if (bing) providers.push(bing);

    const baidu = this.getBaiduConfig();
    if (baidu) providers.push(baidu);

    return providers;
  }

  /**
   * Check if any provider is configured
   */
  hasAnyProvider(): boolean {
    return this.getAllConfiguredProviders().length > 0;
  }

  /**
   * Get preferred provider (first configured one)
   */
  getPreferredProvider(): ProviderConfig | null {
    const providers = this.getAllConfiguredProviders();
    return providers.length > 0 ? providers[0] : null;
  }
}
