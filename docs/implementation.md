# Implementation Details

## Architecture

The extension is built using the VSCode Extension API and follows a Model-View-Controller (MVC) pattern adapted for VSCode Webviews.

### Core Components

#### 1. Extension Entry Point (`src/extension.ts`)
- **Activation**: Registers the core commands and providers.
- **Commands**:
    - `grpc-tester.createRequest`: Opens a file picker for `.proto` files and launches the Webview Panel.
- **Providers**:
    - Registers `GrpcRequestEditorProvider` to handle `*.test-request.json` files as a Custom Editor.

#### 2. Webview Panel (`src/panels/GrpcPanel.ts`)
- **Responsibility**: Renders the HTML/CSS/JS UI for the tester.
- **State Management**: Maintains the current Proto path, definition, and request data.
- **Message Passing**:
    - **To Webview**: Sends `init` (proto definition), `load` (saved data), `sample` (generated JSON), `result` (response), `error`.
    - **From Webview**: Receives `run`, `save`, `generateSample` commands.
- **Dual Mode**: Can be instantiated as a standalone Webview (via Command) or embedded in a Custom Editor.

#### 3. Custom Editor Provider (`src/panels/GrpcRequestEditorProvider.ts`)
- **Integration**: Implements `vscode.CustomTextEditorProvider`.
- **Logic**:
    - Parses the backing JSON document.
    - Instantiates a `GrpcPanel` with the initial data.
    - Syncs changes:
        - Listens for `save` events from the Panel to update the text document.
        - (Optional) Listens for document changes to update the Panel.

#### 4. gRPC Logic (`src/grpcClient.ts`)
- **Libraries**:
    - `@grpc/proto-loader`: For loading `.proto` files.
    - `@grpc/grpc-js`: For gRPC client communication.
    - `protobufjs`: For deep inspection of message types to generate samples.
- **Functions**:
    - `loadProto(path)`: Returns services and methods.
    - `generateSampleMessage(path, service, method)`: Creates a dummy JSON object with default values for the request type.
    - `makeRequest(...)`: Dynamically creates a client and invokes the method.

## Data Storage
Saved requests are stored as standard JSON files (`.test-request.json`) with the following structure:
```json
{
  "protoPath": "/absolute/path/to/file.proto",
  "endpoint": "localhost:50051",
  "service": "ServiceName",
  "method": "MethodName",
  "metadata": "{}",
  "body": "{}"
}
```

## UI/UX
- **Styling**: Uses VSCode's native CSS variables (`var(--vscode-...)`) to adapt to themes (Dark/Light/High Contrast) automatically.
- **Icons**: Uses `@vscode/codicons` for buttons and headers.
- **Editors**: Simple `textarea` elements styled to look like VSCode inputs.
