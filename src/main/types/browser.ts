export interface ProxyConfig {
  host: string;
  port: string;
  username?: string;
  password?: string;
  type?: 'http' | 'https' | 'socks5';
}

export interface FingerprintConfig {
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  timezone?: string;
  language?: string;
  platform?: string;
}

export interface BrowserConfig {
  id?: string;
  name: string;
  platform: BrowserPlatform;
  userDataDir?: string;
  proxy?: ProxyConfig;
  fingerprint?: FingerprintConfig;
  args?: string[];
  extensions?: string[];
  headless?: boolean;
  group?: string;
}

export interface LocalBrowserConfig extends BrowserConfig {
  platform: 'local';
  chromiumPath?: string;
  devtools?: boolean;
}

export interface AdsPowerConfig extends BrowserConfig {
  platform: 'adspower';
  profileId: string;
  apiKey: string;
  serverUrl: string;
  groupId?: string;
}

export interface BitBrowserConfig extends BrowserConfig {
  platform: 'bitbrowser';
  browserId: string;
  apiUrl: string;
  authToken: string;
  proxyId?: string;
}

export type BrowserPlatform = 'local' | 'adspower' | 'bitbrowser';

export interface Browser {
  id: string;
  name: string;
  platform: BrowserPlatform;
  status: BrowserStatus;
  config: BrowserConfig;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  groupId?: string;
}

export type BrowserStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface BrowserGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  browsers: Browser[];
}

export interface BrowserFilter {
  platform?: BrowserPlatform;
  status?: BrowserStatus;
  groupId?: string;
  search?: string;
}

export interface BatchAction {
  type: 'start' | 'stop' | 'restart' | 'delete';
  targetIds: string[];
}

export interface BatchResult {
  success: boolean;
  results: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
}

export interface CreateBrowserRequest {
  name: string;
  platform: BrowserPlatform;
  config: BrowserConfig;
  groupId?: string;
}

export interface BrowserOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface IBrowserPlatform {
  readonly platformType: BrowserPlatform;
  createBrowser(config: BrowserConfig): Promise<Browser>;
  openBrowser(browserId: string): Promise<void>;
  closeBrowser(browserId: string): Promise<void>;
  getBrowserStatus(browserId: string): Promise<BrowserStatus>;
  deleteBrowser(browserId: string): Promise<void>;
  isAvailable(): Promise<boolean>;
}