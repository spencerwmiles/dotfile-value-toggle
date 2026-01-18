import * as vscode from 'vscode';
import { ParsedDotFile } from '../types';
import { parseAllFiles, parseFile, parseDocument } from '../parser/dotFileParser';
import { getConfig } from '../config/settings';

/**
 * Service to watch for changes in dot files and maintain a cache of parsed files
 */
export class FileWatcherService implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private parsedFiles: Map<string, ParsedDotFile> = new Map();
  private _onDidChange = new vscode.EventEmitter<void>();
  
  /** Event fired when any watched file changes */
  public readonly onDidChange = this._onDidChange.event;

  constructor() {
    // Initial setup is done in start()
  }

  /**
   * Start watching files and perform initial parse
   */
  public async start(): Promise<void> {
    await this.refresh();
    this.setupWatchers();
  }

  /**
   * Setup file system watchers for configured patterns
   */
  private setupWatchers(): void {
    // Dispose existing watchers
    this.disposeWatchers();

    const config = getConfig();
    
    for (const pattern of config.filePatterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      
      watcher.onDidChange(async uri => {
        await this.updateFile(uri);
        this._onDidChange.fire();
      });
      
      watcher.onDidCreate(async uri => {
        await this.updateFile(uri);
        this._onDidChange.fire();
      });
      
      watcher.onDidDelete(uri => {
        this.parsedFiles.delete(uri.fsPath);
        this._onDidChange.fire();
      });
      
      this.watchers.push(watcher);
    }
  }

  /**
   * Dispose all file watchers
   */
  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }

  /**
   * Refresh all parsed files
   */
  public async refresh(): Promise<void> {
    this.parsedFiles.clear();
    
    const files = await parseAllFiles();
    for (const file of files) {
      this.parsedFiles.set(file.uri.fsPath, file);
    }
    
    this._onDidChange.fire();
  }

  /**
   * Update a single file in the cache
   */
  private async updateFile(uri: vscode.Uri): Promise<void> {
    try {
      const parsed = await parseFile(uri);
      this.parsedFiles.set(uri.fsPath, parsed);
    } catch (error) {
      console.error(`Failed to update ${uri.fsPath}:`, error);
      this.parsedFiles.delete(uri.fsPath);
    }
  }

  /**
   * Get all currently parsed files
   */
  public getParsedFiles(): ParsedDotFile[] {
    return Array.from(this.parsedFiles.values());
  }

  /**
   * Get a specific parsed file by URI
   */
  public getParsedFile(uri: vscode.Uri): ParsedDotFile | undefined {
    return this.parsedFiles.get(uri.fsPath);
  }

  /**
   * Get or parse a file from the cache or document
   */
  public async getOrParseFile(uri: vscode.Uri): Promise<ParsedDotFile | undefined> {
    // Check if file is in cache
    const cached = this.parsedFiles.get(uri.fsPath);
    if (cached) {
      return cached;
    }

    // Try to parse the file
    try {
      const parsed = await parseFile(uri);
      this.parsedFiles.set(uri.fsPath, parsed);
      return parsed;
    } catch {
      return undefined;
    }
  }

  /**
   * Parse an active document (may have unsaved changes)
   */
  public parseActiveDocument(document: vscode.TextDocument): ParsedDotFile {
    return parseDocument(document);
  }

  /**
   * Check if a file matches any of the configured patterns
   */
  public isWatchedFile(uri: vscode.Uri): boolean {
    const config = getConfig();
    const fileName = uri.fsPath.split(/[/\\]/).pop() || '';
    const filePath = uri.fsPath;
    
    for (const pattern of config.filePatterns) {
      // Handle common glob patterns
      if (pattern.includes('.env')) {
        // Match .env, .env.local, .env.development, etc.
        if (fileName === '.env' || fileName.startsWith('.env.')) {
          return true;
        }
      }
      if (pattern.endsWith('.flags') || pattern.includes('/.flags')) {
        if (fileName === '.flags') {
          return true;
        }
      }
      if (pattern.endsWith('.config') || pattern.includes('/.config')) {
        if (fileName === '.config') {
          return true;
        }
      }
      // Generic pattern: extract the file part after last /
      const patternFile = pattern.split(/[/\\]/).pop() || '';
      if (patternFile.startsWith('.')) {
        // It's a dot file pattern
        const basePattern = patternFile.replace('*', '');
        if (fileName.startsWith(basePattern)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposeWatchers();
    this._onDidChange.dispose();
    this.parsedFiles.clear();
  }
}
