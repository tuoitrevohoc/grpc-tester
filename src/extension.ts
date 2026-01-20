import * as vscode from 'vscode';
import { GrpcPanel } from './panels/GrpcPanel';
import { GrpcRequestEditorProvider } from './panels/GrpcRequestEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  // Command to open the gRPC Tester Webview
  context.subscriptions.push(
    vscode.commands.registerCommand('grpc-tester.openWebView', () => {
      try {
        GrpcPanel.render(context.extensionUri);
      } catch (e) {
        vscode.window.showErrorMessage("Failed to open gRPC Tester: " + e);
      }
    })
  );

  // Register Custom Editor Provider for .test-request.json
  context.subscriptions.push(GrpcRequestEditorProvider.register(context));
}
