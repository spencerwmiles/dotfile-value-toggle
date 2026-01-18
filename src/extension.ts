import * as vscode from 'vscode';
import { SidebarProvider } from './providers/sidebarProvider';
import { DecorationProvider } from './providers/decorationProvider';
import { CodeLensProvider } from './providers/codeLensProvider';
import { StatusBarProvider } from './providers/statusBarProvider';
import { FileWatcherService } from './services/fileWatcherService';
import { ToggleService } from './services/toggleService';
import { onConfigChange } from './config/settings';

let sidebarProvider: SidebarProvider;
let decorationProvider: DecorationProvider;
let codeLensProvider: CodeLensProvider;
let statusBarProvider: StatusBarProvider;
let fileWatcherService: FileWatcherService;
let toggleService: ToggleService;

export function activate(context: vscode.ExtensionContext) {
  console.log('Dotfile Toggle extension is now active');

  // Initialize services
  toggleService = new ToggleService();
  fileWatcherService = new FileWatcherService();
  
  // Initialize providers
  sidebarProvider = new SidebarProvider(fileWatcherService, toggleService);
  decorationProvider = new DecorationProvider(fileWatcherService);
  codeLensProvider = new CodeLensProvider(fileWatcherService);
  statusBarProvider = new StatusBarProvider(fileWatcherService, toggleService);

  // Register the tree view
  const treeView = vscode.window.createTreeView('dotfileToggle', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: true
  });

  // Register CodeLens provider for all files (filtering is done inside the provider)
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { scheme: 'file' },
    codeLensProvider
  );

  // Register commands
  const toggleCommand = vscode.commands.registerCommand('dotfileToggle.toggle', async (uri: vscode.Uri, line: number) => {
    await toggleService.toggle(uri, line);
    sidebarProvider.refresh();
    decorationProvider.updateDecorations();
  });

  const refreshCommand = vscode.commands.registerCommand('dotfileToggle.refresh', () => {
    fileWatcherService.refresh();
    sidebarProvider.refresh();
    decorationProvider.updateDecorations();
  });

  const addToGitignoreCommand = vscode.commands.registerCommand('dotfileToggle.addToGitignore', async (uri: vscode.Uri) => {
    await toggleService.addToGitignore(uri);
  });

  const showStatusBarQuickPickCommand = vscode.commands.registerCommand('dotfileToggle.showStatusBarQuickPick', async () => {
    await statusBarProvider.showQuickPick();
    sidebarProvider.refresh();
    decorationProvider.updateDecorations();
  });

  const toggleSilentCommand = vscode.commands.registerCommand('dotfileToggle.toggleSilent', async (uri: vscode.Uri, line: number) => {
    await toggleService.toggleSilent(uri, line);
    sidebarProvider.refresh();
    decorationProvider.updateDecorations();
  });

  const goToFileCommand = vscode.commands.registerCommand('dotfileToggle.goToFile', async (treeItem: vscode.TreeItem) => {
    if (treeItem.resourceUri) {
      await vscode.window.showTextDocument(treeItem.resourceUri);
    }
  });

  const toggleShowOnlyToggleableCommand = vscode.commands.registerCommand('dotfileToggle.toggleShowOnlyToggleable', async () => {
    const config = vscode.workspace.getConfiguration('dotfileToggle');
    const currentValue = config.get<boolean>('showOnlyToggleable', true);
    await config.update('showOnlyToggleable', !currentValue, vscode.ConfigurationTarget.Global);
    sidebarProvider.refresh();
  });

  // Listen for active editor changes
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      decorationProvider.updateDecorations(editor);
    }
  }, null, context.subscriptions);

  // Listen for document changes
  vscode.workspace.onDidChangeTextDocument(event => {
    const editor = vscode.window.activeTextEditor;
    if (editor && event.document === editor.document) {
      decorationProvider.updateDecorations(editor);
    }
  }, null, context.subscriptions);

  // Listen for config changes
  const configChangeDisposable = onConfigChange(() => {
    fileWatcherService.refresh();
    sidebarProvider.refresh();
    decorationProvider.updateDecorations();
    codeLensProvider.refresh();
  });

  // Initial decoration update
  if (vscode.window.activeTextEditor) {
    decorationProvider.updateDecorations(vscode.window.activeTextEditor);
  }

  // Start watching files
  fileWatcherService.start();

  // File watcher events
  fileWatcherService.onDidChange(() => {
    sidebarProvider.refresh();
    decorationProvider.updateDecorations();
  });

  context.subscriptions.push(
    treeView,
    toggleCommand,
    toggleSilentCommand,
    refreshCommand,
    addToGitignoreCommand,
    showStatusBarQuickPickCommand,
    goToFileCommand,
    toggleShowOnlyToggleableCommand,
    configChangeDisposable,
    fileWatcherService,
    decorationProvider,
    statusBarProvider,
    codeLensDisposable
  );
}

export function deactivate() {
  console.log('Dotfile Toggle extension is now deactivated');
}
