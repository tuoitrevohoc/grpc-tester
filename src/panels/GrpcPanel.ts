import * as vscode from 'vscode';
import * as path from 'path';
import { GrpcClientHelper, ProtoDefinition } from '../grpcClient';

export interface RequestData {
    name?: string;
    endpoint: string;
    service: string;
    method: string;
    metadata: string; // JSON string for ease of editing
    body: string; // JSON string
    protoPath: string;
}

export class GrpcPanel {
  public static currentPanel: GrpcPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  
  // State
  private _currentProtoPath: string = '';
  private _currentDefinition: ProtoDefinition | undefined;
  private _pendingInitialData: RequestData | undefined;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.html = this._getWebviewContent(this._panel.webview);

    this._setWebviewMessageListener(this._panel.webview);
  }

  public static render(extensionUri: vscode.Uri, protoUri?: vscode.Uri) {
    if (GrpcPanel.currentPanel) {
      GrpcPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
    } else {
      const panel = vscode.window.createWebviewPanel(
        'grpc-tester',
        'gRPC Tester',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'dist'),
            vscode.Uri.joinPath(extensionUri, 'node_modules')
          ],
          retainContextWhenHidden: true
        }
      );

      GrpcPanel.currentPanel = new GrpcPanel(panel, extensionUri);
    }
  }

  // Allow creating a panel instance without setting the static singleton (for Custom Editor)
  public static create(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, initialData?: RequestData): GrpcPanel {
      const p = new GrpcPanel(panel, extensionUri);
      if (initialData) {
          p._initFromData(initialData);
      }
      return p;
  }

  public dispose() {
    GrpcPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _initFromData(data: RequestData) {
       // Store data immediately so it's ready when frontend sends 'ready'
       this._pendingInitialData = data;
       
       // Optimization: Start loading proto in background if needed, but don't block
       if (data.protoPath) {
           this._loadProtoDefinition(data.protoPath).catch(err => console.error("Background proto load failed", err));
       }
  }
  
  private async _loadProtoDefinition(fsPath: string) {
      try {
        const def = await GrpcClientHelper.loadProto(fsPath);
        this._currentDefinition = def;
        this._currentProtoPath = fsPath;
        return def;
      } catch(e) {
         vscode.window.showErrorMessage("Failed to parse proto file: " + e);
         return null;
      }
  }

  private _getWebviewContent(webview: vscode.Webview) {
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'));
    const monacoBaseUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', 'monaco-editor', 'min', 'vs'));
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>gRPC Tester</title>
         <link href="${codiconsUri}" rel="stylesheet" />
        <style>
          :root {
              --container-paddding: 20px;
              --input-padding-vertical: 6px;
              --input-padding-horizontal: 4px;
              --input-margin-vertical: 4px;
              --input-margin-horizontal: 0;
              --sidebar-width: 250px;
          }
          body { 
              font-family: var(--vscode-font-family); 
              padding: 0; 
              margin: 0;
              color: var(--vscode-editor-foreground); 
              background-color: var(--vscode-editor-background); 
              height: 100vh;
              display: flex;
          }
           /* Layout */
          #left-panel {
              width: var(--sidebar-width);
              border-right: 1px solid var(--vscode-panel-border);
              background: var(--vscode-sideBar-background);
              display: flex;
              flex-direction: column;
              height: 100%;
          }
          #right-panel {
              flex: 1;
              padding: 20px;
              overflow-y: hidden; /* Important for flex editors */
              height: 100%;
              display: flex;
              flex-direction: column;
              gap: 15px;
          }

          /* Left Panel Items */
          .sidebar-header {
              padding: 10px;
              font-weight: bold;
              border-bottom: 1px solid var(--vscode-panel-border);
              display: flex;
              justify-content: space-between;
              align-items: center;
          }
          .icon-btn {
              cursor: pointer;
              background: none;
              border: none;
              color: var(--vscode-icon-foreground);
          }
          .icon-btn:hover { color: var(--vscode-icon-foreground); opacity: 0.8; }
          
          #test-list {
              flex: 1;
              overflow-y: auto;
              list-style: none;
              padding: 0;
              margin: 0;
          }
          .test-item {
              padding: 8px 10px;
              cursor: pointer;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid var(--vscode-tree-indentGuidesStroke);
          }
          .test-item:hover {
              background-color: var(--vscode-list-hoverBackground);
          }
          .test-item.active {
              background-color: var(--vscode-list-activeSelectionBackground);
              color: var(--vscode-list-activeSelectionForeground);
          }
          .test-item .delete-btn {
              visibility: hidden;
              font-size: 12px;
          }
          .test-item:hover .delete-btn {
              visibility: visible;
          }

          /* Right Panel Form */
          .form-group {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 8px; /* Slightly reduced margin */
          }
          .form-group label {
              font-weight: bold;
              min-width: 120px; /* Connects input alignment */
              margin-bottom: 0;
              font-size: 0.9em;
              white-space: nowrap;
          }
          .form-group input, .form-group select {
              flex: 1;
              background: var(--vscode-input-background); 
              color: var(--vscode-input-foreground); 
              border: 1px solid var(--vscode-input-border); 
              padding: 8px 5px; 
              box-sizing: border-box;
          }
          input:disabled { opacity: 0.6; }
          
          /* Editor section helper */
          .editor-label-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
          }
          .editor-label-row label {
              font-weight: bold;
              font-size: 0.9em;
          }
          
          /* Editor Containers */
          .editor-container {
              border: 1px solid var(--vscode-input-border);
              width: 100%;
              overflow: hidden;
          }
          #metadata-container { height: 80px; }
          #body-container { height: 150px; } /* Fixed smaller height for payload */
          #response-container { flex: 1; min-height: 200px; } /* Take remaining space */
          
          button {
              background: var(--vscode-button-background);
              color: var(--vscode-button-foreground);
              border: none;
              padding: 8px 12px;
              cursor: pointer;
          }
          
          /* ... existing button styles ... */
          button:hover { background: var(--vscode-button-hoverBackground); }
          button.secondary {
              background: var(--vscode-button-secondaryBackground);
              color: var(--vscode-button-secondaryForeground);
          }
          button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }

          .codicon { vertical-align: middle; margin-right: 5px; }
          
          .empty-state {
              text-align: center;
              margin-top: 50px;
              color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
      
        <!-- LEFT PANEL -->
        <div id="left-panel">
            <div class="sidebar-header">
                <span>Test Requests</span>
                <button class="icon-btn" id="refresh-tests-btn" title="Refresh"><span class="codicon codicon-refresh"></span></button>
                <button class="icon-btn" id="new-test-btn" title="New Test"><span class="codicon codicon-add"></span></button>
            </div>
            <ul id="test-list">
                <!-- Test items injected here -->
            </ul>
        </div>

        <!-- RIGHT PANEL -->
        <div id="right-panel">
            
            <div class="form-group">
              <label><span class="codicon codicon-server"></span> Endpoint</label>
              <input type="text" id="endpoint" style="flex: 2;" placeholder="localhost:50051" />
           </div>
           
            <div class="form-group">
                <label><span class="codicon codicon-tag"></span> Test Name</label>
                <input type="text" id="test-name" placeholder="My Test Request" />
                 <div style="display:flex; gap: 5px; margin-left: 10px;">
                     <button id="save-btn" class="secondary"><span class="codicon codicon-save"></span> Save</button>
                     <button id="run-btn"><span class="codicon codicon-play"></span> Run</button>
                 </div>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--vscode-settings-dropdownBorder); width: 100%; margin: 10px 0;" />
          
            <div class="form-group">
                <label><span class="codicon codicon-file-code"></span> Proto File</label>
                <select id="proto-select">
                    <option value="">Select a proto file...</option>
                </select>
            </div>

            <div style="display: flex; gap: 20px;">
               <div class="form-group" style="flex: 1;">
                  <label><span class="codicon codicon-symbol-interface"></span> Service</label>
                  <select id="service-select" disabled></select>
               </div>
               <div class="form-group" style="flex: 1;">
                  <label><span class="codicon codicon-symbol-method"></span> Method</label>
                  <select id="method-select" disabled></select>
               </div>
            </div>

           <div>
             <div class="editor-label-row">
                 <label><span class="codicon codicon-list-tree"></span> Metadata (JSON)</label>
             </div>
             <div id="metadata-container" class="editor-container"></div>
           </div>

           <div>
             <div class="editor-label-row">
                 <label><span class="codicon codicon-code"></span> Request Body (JSON)</label>
             </div>
             <div id="body-container" class="editor-container"></div>
           </div>

           <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
             <div class="editor-label-row">
                 <label><span class="codicon codicon-output"></span> Response</label>
             </div>
             <div id="response-container" class="editor-container"></div>
           </div>
        </div>

        <script src="${monacoBaseUri}/loader.js"></script>
        <script>
            const vscode = acquireVsCodeApi();
            
            // Monaco Init
            require.config({ paths: { 'vs': '${monacoBaseUri}' } });
            
            let metadataEditor;
            let bodyEditor;
            let responseEditor;
            
            // State
            let protos = [];
            let currentDef = null;
            let currentTest = null; 

            // Elements
            const testList = document.getElementById('test-list');
            const protoSelect = document.getElementById('proto-select');
            const serviceSelect = document.getElementById('service-select');
            const methodSelect = document.getElementById('method-select');
            const endpointInput = document.getElementById('endpoint');
            const testNameInput = document.getElementById('test-name');

            // --- Init Monaco & App ---
            require(['vs/editor/editor.main'], function() {
                // Determine theme (simple detection)
                const isDark = document.body.classList.contains('vscode-dark') || true; // default to dark mostly
                
                metadataEditor = monaco.editor.create(document.getElementById('metadata-container'), {
                    value: '{}',
                    language: 'json',
                    theme: 'vs-dark',
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false
                });
                
                bodyEditor = monaco.editor.create(document.getElementById('body-container'), {
                    value: '{}',
                    language: 'json',
                    theme: 'vs-dark',
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false
                });

                responseEditor = monaco.editor.create(document.getElementById('response-container'), {
                    value: '',
                    language: 'json',
                    theme: 'vs-dark',
                    minimap: { enabled: false },
                    readOnly: true,
                    automaticLayout: true,
                    scrollBeyondLastLine: false
                });

                // Request initial data after editor is ready
                vscode.postMessage({ command: 'ready' });
                vscode.postMessage({ command: 'getProtos' });
                vscode.postMessage({ command: 'getTests' });
            });

            // --- Event Listeners ---
            
            document.getElementById('new-test-btn').addEventListener('click', () => {
                clearForm();
            });
            
            document.getElementById('refresh-tests-btn').addEventListener('click', () => {
                vscode.postMessage({ command: 'getTests' });
                vscode.postMessage({ command: 'getProtos' });
            });

            protoSelect.addEventListener('change', () => {
                const protoPath = protoSelect.value;
                if(protoPath) {
                    vscode.postMessage({ command: 'loadProto', path: protoPath });
                } else {
                    serviceSelect.innerHTML = '';
                    methodSelect.innerHTML = '';
                    serviceSelect.disabled = true;
                    methodSelect.disabled = true;
                }
            });

            serviceSelect.addEventListener('change', () => {
                updateMethods();
            });
            
            methodSelect.addEventListener('change', () => {
               requestSample();
            });
            
            function requestSample() {
               const service = serviceSelect.value;
               const method = methodSelect.value;
               if(service && method) {
                   vscode.postMessage({
                        command: 'generateSample',
                        protoPath: protoSelect.value,
                        service: service,
                        method: method
                    });
               }
            }

            document.getElementById('run-btn').addEventListener('click', () => {
                setLoading(true);
                vscode.postMessage({
                    command: 'run',
                    endpoint: endpointInput.value,
                    service: serviceSelect.value,
                    method: methodSelect.value,
                    metadata: metadataEditor.getValue(),
                    body: bodyEditor.getValue(),
                    protoPath: protoSelect.value
                });
            });
            
            function setLoading(isLoading) {
                const runBtn = document.getElementById('run-btn');
                if(isLoading) {
                    runBtn.disabled = true;
                    runBtn.innerHTML = '<span class="codicon codicon-loading codicon-modifier-spin"></span> Running...';
                    if (responseEditor) responseEditor.setValue('Running...');
                } else {
                    runBtn.disabled = false;
                    runBtn.innerHTML = '<span class="codicon codicon-play"></span> Run';
                }
            }
            
            document.getElementById('save-btn').addEventListener('click', () => {
                const name = testNameInput.value.trim();
                if(!name) { 
                    vscode.postMessage({ command: 'alert', message: 'Please enter a test name' });
                    return;
                }
                vscode.postMessage({
                    command: 'save',
                    name: name,
                    endpoint: endpointInput.value,
                    service: serviceSelect.value,
                    method: methodSelect.value,
                    metadata: metadataEditor.getValue(),
                    body: bodyEditor.getValue(),
                    protoPath: protoSelect.value
                });
            });

            // --- Logic ---

            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateProtos':
                        protos = message.files;
                        populateProtos(protos);
                        break;
                    case 'updateTests':
                        renderTestList(message.files);
                        break;
                    case 'protoLoaded':
                        currentDef = message.data;
                        serviceSelect.disabled = false;
                        populateServices(currentDef.services);
                        updateMethods();
                        
                        if(currentTest && currentTest.service) {
                            serviceSelect.value = currentTest.service;
                            updateMethods();
                            if(currentTest.method) methodSelect.value = currentTest.method;
                            currentTest = null;
                        } else {
                            // If no current test (clean load), generate sample for default method
                            requestSample();
                        }
                        break;
                    case 'load':
                         const data = message.data;
                         loadTestData(data);
                         break;
                    case 'sample':
                        if(bodyEditor) {
                            bodyEditor.setValue(JSON.stringify(message.data, null, 2));
                        }
                        break;
                   case 'result':
                        setLoading(false);
                        if(responseEditor) responseEditor.setValue(JSON.stringify(message.result, null, 2));
                        break;
                   case 'error':
                        setLoading(false);
                        if(responseEditor) responseEditor.setValue(message.error);
                        break;
                }
            });

            function populateProtos(files) {
                const currentVal = protoSelect.value;
                protoSelect.innerHTML = '<option value="">Select a proto file...</option>';
                files.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f.fsPath; 
                    opt.innerText = f.name;
                    protoSelect.appendChild(opt);
                });
                if(currentVal) protoSelect.value = currentVal;
            }

            function renderTestList(files) {
                testList.innerHTML = '';
                files.forEach(f => {
                    const li = document.createElement('li');
                    li.className = 'test-item';
                    
                    const span = document.createElement('span');
                    // f.name is now the test name, not filename
                    span.innerText = f.name; 
                    
                    const delBtn = document.createElement('span');
                    delBtn.className = 'codicon codicon-trash delete-btn';
                    delBtn.title = 'Delete';
                    delBtn.onclick = (e) => {
                        e.stopPropagation();
                        if(confirm('Delete ' + f.name + '?')) {
                            vscode.postMessage({ command: 'deleteTest', path: f.fsPath, name: f.name });
                        }
                    };

                    li.onclick = () => {
                         document.querySelectorAll('.test-item').forEach(i => i.classList.remove('active'));
                         li.classList.add('active');
                         vscode.postMessage({ command: 'loadTest', path: f.fsPath, name: f.name });
                    };

                    li.appendChild(span);
                    li.appendChild(delBtn);
                    testList.appendChild(li);
                });
            }

            function populateServices(services) {
                serviceSelect.innerHTML = '';
                services.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s;
                    opt.innerText = s;
                    serviceSelect.appendChild(opt);
                });
                if(services.length > 0) updateMethods();
            }

            function updateMethods() {
                methodSelect.innerHTML = '';
                methodSelect.disabled = false;
                const service = serviceSelect.value;
                if (service && currentDef && currentDef.methods[service]) {
                    currentDef.methods[service].forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m;
                        opt.innerText = m;
                        methodSelect.appendChild(opt);
                    });
                }
                // Don't auto-request sample here recursively, only if we want default
            }
            
            function clearForm() {
                testNameInput.value = '';
                endpointInput.value = '';
                if(metadataEditor) metadataEditor.setValue('{}');
                if(bodyEditor) bodyEditor.setValue('{}');
                if(responseEditor) responseEditor.setValue('');
                document.querySelectorAll('.test-item').forEach(i => i.classList.remove('active'));
            }

            function loadTestData(data) {
                testNameInput.value = data.name || '';
                endpointInput.value = data.endpoint || '';
                if(metadataEditor) metadataEditor.setValue(data.metadata || '{}');
                if(bodyEditor) bodyEditor.setValue(data.body || '{}');
                if(responseEditor) responseEditor.setValue('');
                
                if (data.protoPath) {
                    protoSelect.value = data.protoPath;
                    currentTest = data;
                    vscode.postMessage({ command: 'loadProto', path: data.protoPath });
                }
            }

        </script>
      </body>
      </html>
    `;
  }

  private _setWebviewMessageListener(webview: vscode.Webview) {
    webview.onDidReceiveMessage(
      async (message: any) => {
        switch (message.command) {
          case 'ready':
              if (this._pendingInitialData) {
                  webview.postMessage({ command: 'load', data: this._pendingInitialData });
                  this._pendingInitialData = undefined;
              }
              break;
          case 'getProtos':
              const protos = await this._findProtos();
              webview.postMessage({ command: 'updateProtos', files: protos });
              break;
          case 'getTests':
              const tests = await this._findTests();
              webview.postMessage({ command: 'updateTests', files: tests });
              break;
          case 'loadProto':
              const def = await this._loadProtoDefinition(message.path);
              if(def) {
                   webview.postMessage({ command: 'protoLoaded', data: def, path: message.path });
              }
              break;
          case 'generateSample':
                if (!message.protoPath) return;
                try {
                    const sample = await GrpcClientHelper.generateSampleMessage(message.protoPath, message.service, message.method);
                    webview.postMessage({ command: 'sample', data: sample });
                } catch(e) {
                    // ignore error or warn
                }
                break;
          case 'run':
             try {
                 if(!message.protoPath) throw new Error("No proto file selected");
                 // Ensure definition is loaded for logic if needed, though helper might just need path
                 const result = await GrpcClientHelper.makeRequest(
                     message.protoPath,
                     message.service,
                     message.method,
                     message.endpoint,
                     JSON.parse(message.body || '{}'),
                     JSON.parse(message.metadata || '{}')
                 );
                  webview.postMessage({ command: 'result', result: result });
             } catch(e: any) {
                  webview.postMessage({ command: 'error', error: e.message || String(e) });
             }
            break;
          case 'save':
               if (this._onSave) {
                   this._onSave(message);
               } else {
                   await this._saveTest(message);
                   // Refresh list
                   const updatedTests = await this._findTests();
                   webview.postMessage({ command: 'updateTests', files: updatedTests });
               }
             break;
            case 'loadTest':
                 // Support loading from service file (array) or legacy single file
                 const loadResult = await this._readTest(message.path, message.name);
                 if(loadResult) {
                     webview.postMessage({ command: 'load', data: loadResult });
                 }
                 break;
             case 'deleteTest':
                  await this._deleteTest(message.path, message.name);
                  const afterDelete = await this._findTests();
                  webview.postMessage({ command: 'updateTests', files: afterDelete });
                 break;
             case 'alert':
                 vscode.window.showErrorMessage(message.message);
                 break;
          }
        },
        undefined,
        this._disposables
      );
    }
  
    // File Helpers
    private async _findProtos(): Promise<{name: string, fsPath: string}[]> {
        const files = await vscode.workspace.findFiles('**/*.proto', '**/node_modules/**');
        return files.map(f => ({
            name: path.basename(f.fsPath),
            fsPath: f.fsPath
        }));
    }
  
    private async _findTests(): Promise<{name: string, fsPath: string, service?: string}[]> {
        if (!vscode.workspace.workspaceFolders) return [];
        const rootUri = vscode.workspace.workspaceFolders[0].uri;
        const testFolderUri = vscode.Uri.joinPath(rootUri, '.grpc-tests');
        
        try {
            await vscode.workspace.fs.createDirectory(testFolderUri);
        } catch(e) { /* ignore if exists */ }
  
        // Find all JSON files in .grpc-tests
        const pattern = new vscode.RelativePattern(testFolderUri, '*.json');
        const files = await vscode.workspace.findFiles(pattern);
        
        const allTests: {name: string, fsPath: string, service?: string}[] = [];
  
        for (const file of files) {
            try {
                const buffer = await vscode.workspace.fs.readFile(file);
                const content = buffer.toString();
                if(!content.trim()) continue;
                
                const json = JSON.parse(content);
                
                // Schema: { service, endpoint, protoPath, tests: [] }
                if (json.tests && Array.isArray(json.tests)) {
                    json.tests.forEach((t: any) => {
                        allTests.push({
                            name: t.name,
                            fsPath: file.fsPath,
                            service: json.service
                        });
                    });
                } 
                // Legacy Array Schema
                else if (Array.isArray(json)) {
                    json.forEach((t: any) => {
                         allTests.push({
                            name: t.name,
                            fsPath: file.fsPath,
                            service: t.service
                        });
                    });
                }
                // Legacy Single Object
                else if (json.name) {
                     allTests.push({
                        name: json.name,
                        fsPath: file.fsPath,
                        service: json.service
                    });
                }
            } catch(e) {
                console.warn(`Failed to parse ${file.fsPath}`, e);
            }
        }
        
        return allTests.sort((a,b) => a.name.localeCompare(b.name));
    }
  
    private async _saveTest(data: any) {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage("Open a workspace to save tests.");
            return;
        }
        const rootUri = vscode.workspace.workspaceFolders[0].uri;
        const testFolderUri = vscode.Uri.joinPath(rootUri, '.grpc-tests');
        await vscode.workspace.fs.createDirectory(testFolderUri);
  
        // Determine filename
        const serviceName = data.service || 'default';
        const sanitizedService = serviceName.replace(/[^a-z0-9]/gi, '_');
        const fileUri = vscode.Uri.joinPath(testFolderUri, `${sanitizedService}.json`);
        
        // Read existing structure
        let fileData = {
            service: serviceName,
            endpoint: data.endpoint,
            protoPath: data.protoPath,
            tests: [] as any[]
        };
        
        try {
            const buffer = await vscode.workspace.fs.readFile(fileUri);
            const content = buffer.toString();
            const existingJson = JSON.parse(content);
            
            // Check schema and migrate if needed
            if (existingJson.tests && Array.isArray(existingJson.tests)) {
                fileData = existingJson;
                // Update top-level shared props
                fileData.endpoint = data.endpoint; 
                fileData.protoPath = data.protoPath;
            } else if (Array.isArray(existingJson)) {
                // Migrate array to new schema
                fileData.tests = existingJson;
                // Use current request to set initial shared props if missing
                fileData.endpoint = data.endpoint;
                fileData.protoPath = data.protoPath;
            } else if (existingJson.name) {
                // Migrate single obj
                fileData.tests = [existingJson];
                fileData.endpoint = data.endpoint;
                fileData.protoPath = data.protoPath;
            }
        } catch(e) {
            // New file
        }
  
        // Clean data item - remove shared props from individual test item to save space (optional, but good for consistency)
        // But user might want to override? Request says "Use the same endpoint for the entire services".
        // So we enforce top level.
        const testItem = {
            name: data.name,
            method: data.method,
            metadata: data.metadata,
            body: data.body,
            // Don't store endpoint/service/protoPath in item
        };
  
        // Upsert
        const idx = fileData.tests.findIndex(t => t.name === data.name);
        if (idx >= 0) {
            fileData.tests[idx] = testItem;
        } else {
            fileData.tests.push(testItem);
        }
        
        const content = JSON.stringify(fileData, null, 2);
        await vscode.workspace.fs.writeFile(fileUri, new Uint8Array(Buffer.from(content)));
        
        vscode.window.showInformationMessage(`Saved ${data.name} to ${sanitizedService}.json`);
    }
  
    private async _readTest(fsPath: string, testName?: string) {
        try {
            const uri = vscode.Uri.file(fsPath);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const content = Buffer.from(bytes).toString('utf8');
            if (!content.trim()) { return null; }
            
            const json = JSON.parse(content);
            
            // Handle Schema: { service, endpoint, protoPath, tests: [] }
            if (json.tests && Array.isArray(json.tests)) {
                if (testName) {
                    const t = json.tests.find((x: any) => x.name === testName);
                    if (t) {
                        // Merge shared props back in for the frontend
                        return {
                            ...t,
                            service: json.service,
                            endpoint: json.endpoint,
                            protoPath: json.protoPath
                        };
                    }
                }
                // Fallback: first
                if (json.tests.length > 0) {
                     return {
                        ...json.tests[0],
                        service: json.service,
                        endpoint: json.endpoint,
                        protoPath: json.protoPath
                    };
                }
                return null;
            }
            
            // Handle Legacy Array
            if(Array.isArray(json)) {
                if(testName) return json.find((t:any) => t.name === testName);
                return json[0];
            } 
            
            // Handle Legacy Single
            return json;
            
        } catch(e) {
            vscode.window.showErrorMessage("Failed to read test file: " + e);
            return null;
        }
    }
    
    private async _deleteTest(fsPath: string, testName: string) {
        try {
            const uri = vscode.Uri.file(fsPath);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const json = JSON.parse(Buffer.from(bytes).toString());
            
            // New Schema
            if(json.tests && Array.isArray(json.tests)) {
                json.tests = json.tests.filter((t: any) => t.name !== testName);
                 if (json.tests.length === 0) {
                    // Delete file if empty? Or keep shell? Let's delete to clean up.
                    await vscode.workspace.fs.delete(uri);
                } else {
                    const content = JSON.stringify(json, null, 2);
                    await vscode.workspace.fs.writeFile(uri, new Uint8Array(Buffer.from(content)));
                }
                return;
            }
  
            // Legacy Array
            if (Array.isArray(json)) {
                const newTests = json.filter((t:any) => t.name !== testName);
                if (newTests.length === 0) {
                    await vscode.workspace.fs.delete(uri);
                } else {
                    const content = JSON.stringify(newTests, null, 2);
                    await vscode.workspace.fs.writeFile(uri, new Uint8Array(Buffer.from(content)));
                }
            } else {
                // Legacy single file
                await vscode.workspace.fs.delete(uri);
            }
        } catch(e) {
            vscode.window.showErrorMessage("Failed to delete test: " + e);
        }
    }
  
    // Callback for custom save logic (e.g. for CustomEditor)
    private _onSave: ((data: any) => void) | undefined;
    public setOnSave(callback: (data: any) => void) {
        this._onSave = callback;
    }
  }
