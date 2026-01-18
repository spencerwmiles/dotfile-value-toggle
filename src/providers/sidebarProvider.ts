import * as vscode from 'vscode';
import { ParsedDotFile, DotFileEntry, TreeItemType, TreeItemData } from '../types';
import { FileWatcherService } from '../services/fileWatcherService';
import { ToggleService } from '../services/toggleService';
import { getConfig } from '../config/settings';

/**
 * Tree item for the sidebar view
 */
class FlagTreeItem extends vscode.TreeItem {
  constructor(
    public readonly data: TreeItemData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super('', collapsibleState);
    this.setup();
  }

  private setup(): void {
    if (this.data.type === TreeItemType.File && this.data.file) {
      this.setupFileItem(this.data.file);
    } else if (this.data.type === TreeItemType.Entry && this.data.entry && this.data.fileUri) {
      this.setupEntryItem(this.data.entry, this.data.fileUri);
    }
  }

  private setupFileItem(file: ParsedDotFile): void {
    this.label = file.relativePath;
    this.tooltip = `${file.relativePath}\n${file.toggleableEntries.length} toggleable values`;
    this.iconPath = new vscode.ThemeIcon('file');
    this.contextValue = 'flagFile';
    this.resourceUri = file.uri;
    
    // Show count of toggleable entries
    this.description = `(${file.toggleableEntries.length} toggleable)`;
  }

  private setupEntryItem(entry: DotFileEntry, fileUri: vscode.Uri): void {
    this.label = entry.key;
    this.description = entry.value;
    
    if (entry.isToggleable) {
      this.tooltip = `Click to toggle: ${entry.key}=${entry.value}`;
      this.iconPath = new vscode.ThemeIcon('symbol-boolean');
      this.contextValue = 'flagEntry';
      
      // Make it clickable to toggle (silent - doesn't open file)
      this.command = {
        command: 'dotfileToggle.toggleSilent',
        title: 'Toggle Value',
        arguments: [fileUri, entry.line]
      };
    } else {
      this.tooltip = `${entry.key}=${entry.value} (not toggleable)`;
      this.iconPath = new vscode.ThemeIcon('symbol-string');
      this.contextValue = 'flagEntryDisabled';
    }
  }
}

/**
 * Tree data provider for the Dotfile Toggle sidebar
 */
export class SidebarProvider implements vscode.TreeDataProvider<FlagTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<FlagTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private fileWatcherService: FileWatcherService,
    private toggleService: ToggleService
  ) {}

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item representation
   */
  getTreeItem(element: FlagTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for a tree item
   */
  async getChildren(element?: FlagTreeItem): Promise<FlagTreeItem[]> {
    if (!element) {
      // Root level - return files
      return this.getFileItems();
    }

    if (element.data.type === TreeItemType.File && element.data.file) {
      // File level - return entries
      return this.getEntryItems(element.data.file);
    }

    return [];
  }

  /**
   * Get file items for root level
   */
  private getFileItems(): FlagTreeItem[] {
    const parsedFiles = this.fileWatcherService.getParsedFiles();
    const config = getConfig();
    
    // Filter based on showOnlyToggleable setting
    const filesWithEntries = config.showOnlyToggleable
      ? parsedFiles.filter(f => f.toggleableEntries.length > 0)
      : parsedFiles.filter(f => f.entries.length > 0);
    
    // Sort by path
    filesWithEntries.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return filesWithEntries.map(file => new FlagTreeItem(
      {
        type: TreeItemType.File,
        file
      },
      vscode.TreeItemCollapsibleState.Expanded
    ));
  }

  /**
   * Get entry items for a file
   */
  private getEntryItems(file: ParsedDotFile): FlagTreeItem[] {
    const config = getConfig();
    
    // Filter based on showOnlyToggleable setting
    const entries = config.showOnlyToggleable
      ? file.toggleableEntries
      : file.entries;
    
    // Show toggleable entries first, then others (when showing all)
    const sortedEntries = [...entries].sort((a, b) => {
      if (a.isToggleable && !b.isToggleable) return -1;
      if (!a.isToggleable && b.isToggleable) return 1;
      return a.line - b.line;
    });

    return sortedEntries.map(entry => new FlagTreeItem(
      {
        type: TreeItemType.Entry,
        entry,
        fileUri: file.uri
      },
      vscode.TreeItemCollapsibleState.None
    ));
  }

  /**
   * Get parent of a tree item (for reveal functionality)
   */
  getParent(element: FlagTreeItem): FlagTreeItem | undefined {
    if (element.data.type === TreeItemType.Entry && element.data.fileUri) {
      const file = this.fileWatcherService.getParsedFile(element.data.fileUri);
      if (file) {
        return new FlagTreeItem(
          {
            type: TreeItemType.File,
            file
          },
          vscode.TreeItemCollapsibleState.Expanded
        );
      }
    }
    return undefined;
  }
}
