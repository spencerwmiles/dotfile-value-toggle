import * as vscode from 'vscode';
import { FileWatcherService } from '../services/fileWatcherService';
import { DotFileEntry } from '../types';

/**
 * CodeLens provider for toggle actions in dot files
 */
export class CodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(private fileWatcherService: FileWatcherService) {
    // Refresh code lenses when files change
    fileWatcherService.onDidChange(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  /**
   * Provide code lenses for the document
   */
  provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    // Check if this file should have code lenses
    const isWatched = this.fileWatcherService.isWatchedFile(document.uri);
    if (!isWatched) {
      return [];
    }

    // Parse the document
    const parsed = this.fileWatcherService.parseActiveDocument(document);
    
    // Create code lenses only for toggleable entries
    const codeLenses: vscode.CodeLens[] = [];

    for (const entry of parsed.toggleableEntries) {
      const codeLens = this.createCodeLens(entry, document);
      if (codeLens) {
        codeLenses.push(codeLens);
      }
    }

    return codeLenses;
  }

  /**
   * Resolve a code lens (add command)
   */
  resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken
  ): vscode.CodeLens {
    // CodeLens is already resolved in provideCodeLenses
    return codeLens;
  }

  /**
   * Create a code lens for an entry
   */
  private createCodeLens(entry: DotFileEntry, document: vscode.TextDocument): vscode.CodeLens | null {
    if (!entry.isToggleable || !entry.toggleValues) {
      return null;
    }

    const range = new vscode.Range(entry.line, 0, entry.line, 0);
    
    // Find the next value in the cycle
    const currentIndex = entry.toggleValues.findIndex(v => {
      const unquoted = entry.value.replace(/^["']|["']$/g, '');
      return v === unquoted;
    });
    const nextIndex = (currentIndex + 1) % entry.toggleValues.length;
    const nextValue = entry.toggleValues[nextIndex];

    return new vscode.CodeLens(range, {
      title: `⟳ Toggle to "${nextValue}"`,
      command: 'dotfileToggle.toggle',
      arguments: [document.uri, entry.line],
      tooltip: `Toggle ${entry.key} from "${entry.value}" to "${nextValue}"`
    });
  }

  /**
   * Notify that code lenses should be refreshed
   */
  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }
}
