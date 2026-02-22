import * as vscode from 'vscode';
import { FileWatcherService } from '../services/fileWatcherService';
import { DotFileEntry } from '../types';

/**
 * Provider for inline decorations showing toggle status
 */
export class DecorationProvider implements vscode.Disposable {
  private toggleableDecorationType: vscode.TextEditorDecorationType;
  private nonToggleableDecorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];

  constructor(private fileWatcherService: FileWatcherService) {
    // Decoration for toggleable values - subtle highlight (not button-like since decorations aren't clickable)
    this.toggleableDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
      borderRadius: '3px',
      border: '1px solid',
      borderColor: new vscode.ThemeColor('charts.green')
    });

    // Decoration for non-toggleable values - subtle
    this.nonToggleableDecorationType = vscode.window.createTextEditorDecorationType({
      opacity: '0.7'
    });
  }

  /**
   * Update decorations for the active editor or a specific editor
   */
  public updateDecorations(editor?: vscode.TextEditor): void {
    const activeEditor = editor || vscode.window.activeTextEditor;
    if (!activeEditor) {
      return;
    }

    // Check if this file should be decorated
    const isWatched = this.fileWatcherService.isWatchedFile(activeEditor.document.uri);
    if (!isWatched) {
      // Clear decorations for non-watched files
      activeEditor.setDecorations(this.toggleableDecorationType, []);
      activeEditor.setDecorations(this.nonToggleableDecorationType, []);
      return;
    }

    // Parse the document
    const parsed = this.fileWatcherService.parseActiveDocument(activeEditor.document);
    
    // Create decorations
    const toggleableDecorations: vscode.DecorationOptions[] = [];
    const nonToggleableDecorations: vscode.DecorationOptions[] = [];

    for (const entry of parsed.entries) {
      const decoration = this.createDecoration(entry, activeEditor.document);
      
      if (entry.isToggleable) {
        toggleableDecorations.push(decoration);
      } else {
        nonToggleableDecorations.push(decoration);
      }
    }

    // Apply decorations
    activeEditor.setDecorations(this.toggleableDecorationType, toggleableDecorations);
    activeEditor.setDecorations(this.nonToggleableDecorationType, nonToggleableDecorations);
  }

  /**
   * Create a decoration for an entry
   */
  private createDecoration(entry: DotFileEntry, document: vscode.TextDocument): vscode.DecorationOptions {
    const valueRange = new vscode.Range(
      entry.line,
      entry.valueStart,
      entry.line,
      entry.valueEnd
    );

    let hoverMessage: vscode.MarkdownString;
    
    if (entry.isToggleable && entry.toggleValues) {
      const nextValue = this.getNextValue(entry.value, entry.toggleValues);
      hoverMessage = new vscode.MarkdownString(undefined, true);
      hoverMessage.supportThemeIcons = true;
      hoverMessage.isTrusted = true;
      hoverMessage.appendMarkdown(`$(sync) **Toggleable Value**\n\n`);
      hoverMessage.appendMarkdown(`\`${entry.key}\` = \`${entry.value}\`\n\n`);
      hoverMessage.appendMarkdown(`Cycle: \`${entry.toggleValues.join('\` → \`')}\`\n\n`);
      hoverMessage.appendMarkdown(`[$(sync~spin) Toggle to \`${nextValue}\`](command:dotfileValueToggle.toggle?${encodeURIComponent(JSON.stringify([document.uri, entry.line]))})`);
    } else {
      hoverMessage = new vscode.MarkdownString(undefined, true);
      hoverMessage.appendMarkdown(`\`${entry.key}\` = \`${entry.value}\`\n\n`);
      hoverMessage.appendMarkdown(`*Not a toggleable value*`);
    }

    return {
      range: valueRange,
      hoverMessage
    };
  }

  /**
   * Get the next value in a toggle values group
   */
  private getNextValue(currentValue: string, toggleValues: string[]): string {
    const unquoted = currentValue.replace(/^["']|["']$/g, '');
    const currentIndex = toggleValues.findIndex(v => v.toLowerCase() === unquoted.toLowerCase());
    const nextIndex = (currentIndex + 1) % toggleValues.length;
    return toggleValues[nextIndex];
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.toggleableDecorationType.dispose();
    this.nonToggleableDecorationType.dispose();
    this.disposables.forEach(d => d.dispose());
  }
}
