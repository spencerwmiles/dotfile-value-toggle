import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Service to check if files are ignored by git
 */
export class GitignoreService {
  /**
   * Check if a file is ignored by git
   * Returns true if the file IS ignored (safe to toggle)
   * Returns false if the file is NOT ignored (warning should be shown)
   */
  public async isIgnored(uri: vscode.Uri): Promise<boolean> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return false;
    }

    try {
      // Use git check-ignore to determine if file is ignored
      const terminal = await this.runGitCommand(
        workspaceFolder.uri.fsPath,
        ['check-ignore', '-q', uri.fsPath]
      );
      
      // Exit code 0 means file is ignored
      // Exit code 1 means file is not ignored
      return terminal;
    } catch {
      // If git command fails (no git repo, etc.), assume not ignored
      return false;
    }
  }

  /**
   * Run a git command and return whether it succeeded
   */
  private async runGitCommand(cwd: string, args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const { exec } = require('child_process');
      exec(
        `git ${args.join(' ')}`,
        { cwd },
        (error: Error | null, stdout: string, stderr: string) => {
          // Exit code 0 = file is ignored
          resolve(!error);
        }
      );
    });
  }

  /**
   * Add a file to .gitignore
   */
  public async addToGitignore(uri: vscode.Uri): Promise<boolean> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('Could not find workspace folder');
      return false;
    }

    const gitignorePath = path.join(workspaceFolder.uri.fsPath, '.gitignore');
    const relativePath = vscode.workspace.asRelativePath(uri, false);

    try {
      // Read existing .gitignore or create empty
      let content = '';
      try {
        const gitignoreUri = vscode.Uri.file(gitignorePath);
        const existingContent = await vscode.workspace.fs.readFile(gitignoreUri);
        content = Buffer.from(existingContent).toString('utf8');
      } catch {
        // .gitignore doesn't exist, that's fine
      }

      // Check if already in gitignore
      const lines = content.split('\n').map(l => l.trim());
      if (lines.includes(relativePath)) {
        vscode.window.showInformationMessage(`${relativePath} is already in .gitignore`);
        return true;
      }

      // Add to gitignore
      const newContent = content.endsWith('\n') || content === ''
        ? `${content}${relativePath}\n`
        : `${content}\n${relativePath}\n`;

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(gitignorePath),
        Buffer.from(newContent, 'utf8')
      );

      vscode.window.showInformationMessage(`Added ${relativePath} to .gitignore`);
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add to .gitignore: ${error}`);
      return false;
    }
  }

  /**
   * Show warning dialog for unignored file
   * Returns 'toggle' if user wants to proceed, 'cancel' if not, 'gitignore' if they want to add to gitignore
   */
  public async showWarning(uri: vscode.Uri): Promise<'toggle' | 'cancel' | 'gitignore'> {
    const relativePath = vscode.workspace.asRelativePath(uri, false);
    
    const result = await vscode.window.showWarningMessage(
      `"${relativePath}" is not in .gitignore and may be committed to git. Are you sure you want to toggle this value?`,
      { modal: false },
      'Toggle Anyway',
      'Add to .gitignore',
      'Cancel'
    );

    switch (result) {
      case 'Toggle Anyway':
        return 'toggle';
      case 'Add to .gitignore':
        return 'gitignore';
      default:
        return 'cancel';
    }
  }
}
