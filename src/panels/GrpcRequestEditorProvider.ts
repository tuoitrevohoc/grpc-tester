import * as vscode from 'vscode';
import { GrpcPanel } from './GrpcPanel';

export class GrpcRequestEditorProvider implements vscode.CustomTextEditorProvider {

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new GrpcRequestEditorProvider(context);
        const providerRegistration = vscode.window.registerCustomEditorProvider(GrpcRequestEditorProvider.viewType, provider);
        return providerRegistration;
    }

    private static readonly viewType = 'grpc-tester.requestEditor';

    constructor(
        private readonly context: vscode.ExtensionContext
    ) { }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        // Create the panel using our existing logic
        // We parse the document content to get initial data
        let initialData: any = {};
        try {
            const text = document.getText();
            if (text.trim().length > 0) {
                initialData = JSON.parse(text);
            }
        } catch (e) {
            console.error("Failed to parse existing request file", e);
        }

        const grpcPanel = GrpcPanel.create(webviewPanel, this.context.extensionUri, initialData);
        
        // Handle Save from Webview -> Update Document
        grpcPanel.setOnSave((data) => {
            const edit = new vscode.WorkspaceEdit();
            // Replace header and body
            const newText = JSON.stringify(data, null, 2);
            edit.replace(
                document.uri, 
                new vscode.Range(0, 0, document.lineCount, 0), 
                newText
            );
            vscode.workspace.applyEdit(edit);
        });

        // Handle Document Change -> Update Webview (optional, might be tricky if two-way binding causes loops)
        // For now, let's rely on Webview being the primary editor for this file type.
        // If we want to support text edits reflecting in Webview, we'd listen to onDidChangeTextDocument
        // and post message 'load' to webview.
    }

    // Unused but required if we were generating HTML directly here
    private getHtmlForWebview(webview: vscode.Webview): string {
        return '';
    }
}
