import * as vscode from 'vscode';
import { FileWatcherService } from '../services/fileWatcherService';
import { ToggleService } from '../services/toggleService';
import { ParsedDotFile, DotFileEntry } from '../types';

/**
 * QuickPick item representing a toggleable entry
 */
interface ToggleQuickPickItem extends vscode.QuickPickItem {
  fileUri: vscode.Uri;
  line: number;
}

/**
 * Provider for the status bar item that shows detected flag files
 * and provides quick access to toggle values
 */
export class StatusBarProvider implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private fileWatcherService: FileWatcherService,
    private toggleService: ToggleService
  ) {
    // Create status bar item aligned to the left with high priority
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    
    this.statusBarItem.command = 'dotfileToggle.showStatusBarQuickPick';
    this.statusBarItem.tooltip = 'Click to toggle flag values';
    
    // Initial update
    this.update();
    this.statusBarItem.show();

    // Subscribe to file watcher changes
    this.disposables.push(
      this.fileWatcherService.onDidChange(() => this.update())
    );
  }

  /**
   * Update the status bar item text based on current files
   */
  public update(): void {
    const parsedFiles = this.fileWatcherService.getParsedFiles();
    const filesWithToggleable = parsedFiles.filter(f => f.toggleableEntries.length > 0);
    const totalToggleable = filesWithToggleable.reduce(
      (sum, f) => sum + f.toggleableEntries.length, 
      0
    );

    if (filesWithToggleable.length === 0) {
      this.statusBarItem.text = '$(symbol-boolean) No flags';
      this.statusBarItem.tooltip = 'No toggleable flag files detected';
    } else {
      const fileText = filesWithToggleable.length === 1 ? 'file' : 'files';
      this.statusBarItem.text = `$(symbol-boolean) ${totalToggleable} flags`;
      this.statusBarItem.tooltip = `${totalToggleable} toggleable values in ${filesWithToggleable.length} ${fileText}\nClick to toggle`;
    }
  }

  /**
   * Show the QuickPick with all toggleable entries
   */
  public async showQuickPick(): Promise<void> {
    const parsedFiles = this.fileWatcherService.getParsedFiles();
    const items: ToggleQuickPickItem[] = [];

    // Build QuickPick items from all toggleable entries
    for (const file of parsedFiles) {
      for (const entry of file.toggleableEntries) {
        items.push(this.createQuickPickItem(file, entry));
      }
    }

    if (items.length === 0) {
      vscode.window.showInformationMessage('No toggleable flag values found');
      return;
    }

    // Sort by file path, then by key
    items.sort((a, b) => {
      const labelCompare = (a.description || '').localeCompare(b.description || '');
      if (labelCompare !== 0) return labelCompare;
      return a.label.localeCompare(b.label);
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a flag to toggle',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await this.toggleService.toggleSilent(selected.fileUri, selected.line);
      // Refresh will happen via file watcher, but update immediately for responsiveness
      this.update();
    }
  }

  /**
   * Create a QuickPick item for a toggleable entry
   */
  private createQuickPickItem(file: ParsedDotFile, entry: DotFileEntry): ToggleQuickPickItem {
    // Get the next value in the cycle
    const unquotedValue = entry.value.replace(/^["']|["']$/g, '');
    const currentIndex = entry.toggleValues?.indexOf(unquotedValue) ?? -1;
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % (entry.toggleValues?.length ?? 1) : 0;
    const nextValue = entry.toggleValues?.[nextIndex] ?? '?';
    
    return {
      label: `$(symbol-boolean) ${entry.key}`,
      description: file.relativePath,
      detail: `${entry.value} → ${nextValue}`,
      fileUri: file.uri,
      line: entry.line
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.statusBarItem.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }
}
