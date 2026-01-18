import * as vscode from 'vscode';
import { ToggleResult, DotFileEntry } from '../types';
import { getConfig, getNextValue } from '../config/settings';
import { parseFile } from '../parser/dotFileParser';
import { GitignoreService } from './gitignoreService';

/**
 * Service to handle toggling values in dot files
 */
export class ToggleService {
  private gitignoreService: GitignoreService;
  // Track files that user has acknowledged warnings for in this session
  private acknowledgedFiles: Set<string> = new Set();

  constructor() {
    this.gitignoreService = new GitignoreService();
  }

  /**
   * Toggle a value at a specific line in a file
   */
  public async toggle(uri: vscode.Uri, line: number): Promise<ToggleResult> {
    try {
      const config = getConfig();

      // Check gitignore status if warning is enabled
      if (config.showGitignoreWarning && !this.acknowledgedFiles.has(uri.fsPath)) {
        const isIgnored = await this.gitignoreService.isIgnored(uri);
        
        if (!isIgnored) {
          const result = await this.gitignoreService.showWarning(uri);
          
          if (result === 'cancel') {
            return { success: false, error: 'Cancelled by user', wasGitignoreWarningShown: true };
          }
          
          if (result === 'gitignore') {
            await this.gitignoreService.addToGitignore(uri);
            // Still proceed with toggle after adding to gitignore
          }
          
          // Remember that user acknowledged this file
          this.acknowledgedFiles.add(uri.fsPath);
        }
      }

      // Parse the file to find the entry
      const parsed = await parseFile(uri);
      const entry = parsed.entries.find(e => e.line === line);

      if (!entry) {
        return { success: false, error: `No entry found at line ${line + 1}` };
      }

      if (!entry.isToggleable || !entry.toggleValues) {
        return { success: false, error: `Value "${entry.value}" is not toggleable` };
      }

      // Calculate the new value
      const newValue = getNextValue(entry.value, entry.toggleValues);

      // Open the document and make the edit
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document, { preview: false });

      // Create the edit
      const lineText = document.lineAt(line);
      const editRange = new vscode.Range(
        line,
        entry.valueStart,
        line,
        entry.valueEnd
      );

      const success = await editor.edit(editBuilder => {
        editBuilder.replace(editRange, newValue);
      });

      if (success) {
        // Save the document
        await document.save();
        
        return { 
          success: true, 
          newValue,
          wasGitignoreWarningShown: false
        };
      } else {
        return { success: false, error: 'Failed to apply edit' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Toggle a specific entry directly
   */
  public async toggleEntry(uri: vscode.Uri, entry: DotFileEntry): Promise<ToggleResult> {
    return this.toggle(uri, entry.line);
  }

  /**
   * Toggle a value silently without opening the file in the editor
   */
  public async toggleSilent(uri: vscode.Uri, line: number): Promise<ToggleResult> {
    try {
      const config = getConfig();

      // Check gitignore status if warning is enabled
      if (config.showGitignoreWarning && !this.acknowledgedFiles.has(uri.fsPath)) {
        const isIgnored = await this.gitignoreService.isIgnored(uri);
        
        if (!isIgnored) {
          const result = await this.gitignoreService.showWarning(uri);
          
          if (result === 'cancel') {
            return { success: false, error: 'Cancelled by user', wasGitignoreWarningShown: true };
          }
          
          if (result === 'gitignore') {
            await this.gitignoreService.addToGitignore(uri);
          }
          
          this.acknowledgedFiles.add(uri.fsPath);
        }
      }

      // Parse the file to find the entry
      const parsed = await parseFile(uri);
      const entry = parsed.entries.find(e => e.line === line);

      if (!entry) {
        return { success: false, error: `No entry found at line ${line + 1}` };
      }

      if (!entry.isToggleable || !entry.toggleValues) {
        return { success: false, error: `Value "${entry.value}" is not toggleable` };
      }

      // Calculate the new value
      const newValue = getNextValue(entry.value, entry.toggleValues);

      // Use WorkspaceEdit to make the change without opening the file
      const document = await vscode.workspace.openTextDocument(uri);
      const editRange = new vscode.Range(
        line,
        entry.valueStart,
        line,
        entry.valueEnd
      );

      const workspaceEdit = new vscode.WorkspaceEdit();
      workspaceEdit.replace(uri, editRange, newValue);
      
      const success = await vscode.workspace.applyEdit(workspaceEdit);

      if (success) {
        await document.save();
        
        return { 
          success: true, 
          newValue,
          wasGitignoreWarningShown: false
        };
      } else {
        return { success: false, error: 'Failed to apply edit' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Add a file to .gitignore
   */
  public async addToGitignore(uri: vscode.Uri): Promise<boolean> {
    return this.gitignoreService.addToGitignore(uri);
  }

  /**
   * Clear acknowledged files (useful for testing or when user wants warnings again)
   */
  public clearAcknowledgedFiles(): void {
    this.acknowledgedFiles.clear();
  }

  /**
   * Check if a file is acknowledged for this session
   */
  public isAcknowledged(uri: vscode.Uri): boolean {
    return this.acknowledgedFiles.has(uri.fsPath);
  }
}
