# gRPC Tester for VS Code

Test gRPC endpoints efficiently directly within VS Code.

## Features

- **Proto Discovery**: Automatically finds `.proto` files in your workspace.
- **Service & Method Browsing**: Select Service and Method defined in your proto files.
- **Interactive Editor**: 
  - Monaco-based JSON editors for Metadata and Request Body.
  - Auto-generated sample request payloads based on Proto definition.
- **Test Management**:
  - Save tests for later use.
  - Tests are stored in `.grpc-tests/<Service>.json` for easy version control.
  - Shared Endpoint and Proto configurations per Service.
- **Execution**: Run requests and view responses (with JSON syntax highlighting) or errors immediately.


## Usage

![How to use](media/How%20to%20use.gif)

1.  **Open the Tester**:
    - Run the command `gRPC-Tester: See all tests` from the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
    - Or open any saved `.test-request.json` file.

2.  **Create a New Test**:
    - Click the **New Test** (`+`) button in the sidebar.
    - Select a **Proto File**.
    - Select a **Service** and **Method**.
    - The **Request Body** will automatically populate with a sample template.

3.  **Run a Test**:
    - Enter the **Endpoint** (e.g., `localhost:50051`).
    - Click **Run**.
    - View the output in the **Response** panel.

4.  **Save a Test**:
    - Enter a **Test Name**.
    - Click **Save**.
    - The test is saved to `.grpc-tests/<ServiceName>.json`. 
    - **Note**: The `Endpoint` and `Proto File` selection are shared across all tests in the same Service.

