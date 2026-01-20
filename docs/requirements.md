# Requirements

## Overview
A VSCode extension for testing gRPC endpoints directly within the editor. This tool allows developers to select proto files, construct requests, and execute them against a running gRPC server.

## Key Features

### 1. Proto File Management
- **Selection**: Users can select `*.proto` files from their workspace.
- **Parsing**: The extension parses the selected proto file to extract Services, Methods, and Message types.

### 2. Request Construction
- **Method Selection**: Users can choose a Service and Method from the parsed proto definition.
- **Endpoint Configuration**: Users can specify the target gRPC server address (e.g., `localhost:50051`).
- **Metadata/Headers**: Support for custom gRPC metadata (headers) in JSON format.
- **Request Body**:
    - Users can edit the request payload in JSON.
    - **Auto-Population**: The extension automatically generates a sample JSON body based on the selected method's request message type structure.

### 3. Execution & Response
- **Run**: Execute the constructed gRPC request.
- **Feedback**: Display the server's response (JSON) or any error messages (e.g., connection refused, status codes).

### 4. Persistence
- **Save Requests**: Users can save their configured requests to files with the `.test-request.json` extension.
- **Open Saved Requests**: Clicking on a `.test-request.json` file in the file explorer opens the custom editor with the saved state (proto path, endpoint, method, body, etc.) pre-loaded.
- **Resume**: Users can immediately run the loaded request.

## Technical Constraints
- **Language**: TypeScript.
- **UI**: VSCode Webview with JSON editing capabilities.
- **Icons**: Use VSCode Codicons (vector font).
