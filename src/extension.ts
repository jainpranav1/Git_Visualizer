// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { simpleGit } from "simple-git";
import * as path from "path";
import { get_git_graph, Graph_Data } from "./helper_functions";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Only allow a single webview
  let currentPanel: vscode.WebviewPanel | undefined = undefined;

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let start = vscode.commands.registerCommand(
    "git-visualizer.start",
    async () => {
      // The code you place here will be executed every time your command is executed

      // makes sure that only 1 workspace is open
      if (vscode.workspace.workspaceFolders == undefined) {
        vscode.window.showInformationMessage("No workspace opened!");
        return 0;
      } else if (vscode.workspace.workspaceFolders.length > 1) {
        vscode.window.showInformationMessage("More than 1 workspace opened!");
        return 0;
      }

      // get path of workspace (first workspace)
      let ws_path = vscode.workspace.workspaceFolders[0].uri.fsPath;

      // get git graph data
      let graph_data = await get_git_graph(ws_path);

      // Create and show a new webview
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          "git_graph", // Identifies the type of the webview. Used internally
          "Git Graph", // Title of the panel displayed to the user
          vscode.ViewColumn.One, // Editor column to show the new webview panel in.
          {
            enableScripts: true,
          } // Webview options. More on these later.
        );

        // Get path to resource on disk
        const onDiskPath = vscode.Uri.file(
          path.join(
            context.extensionPath,
            "node_modules",
            "force-graph",
            "dist",
            "force-graph.js"
          )
        );

        // And get the special URI to use with the webview
        const force_graph_js = currentPanel.webview.asWebviewUri(onDiskPath);

        // And set its HTML content
        currentPanel.webview.html = getWebviewContent(
          force_graph_js,
          graph_data
        );

        currentPanel.onDidDispose(
          () => {
            currentPanel = undefined;
          },
          undefined,
          context.subscriptions
        );

        function getWebviewContent(
          force_graph_js: vscode.Uri,
          graph_data: Graph_Data
        ) {
          return `<head>
          <style> body { margin: 0; } </style>

          <script src="${force_graph_js}"></script>
          </head>

          <body>
          <div id="graph"></div>

          <script>
              const Graph = ForceGraph()
                (document.getElementById('graph'))
                .nodeCanvasObject((node, ctx) => nodePaint(node, ['orange', 'darkblue', 'red', 'green', 'purple', 'maroon'][node.type], ctx))
                .nodePointerAreaPaint(nodePaint)
                .nodeLabel('hover')
                .backgroundColor('white')
                .linkDirectionalArrowLength(6)
                .linkColor(link => 'black')
                .onNodeRightClick(node => {
                    navigator.clipboard.writeText(node.rt_clk);
                })
                .graphData(${JSON.stringify(graph_data)});
                
              // Handle the message inside the webview
              window.addEventListener('message', event => {

                  let old_graph = Graph.graphData();
                  let new_graph = event.data;
        
                  for (let i = 0; i < new_graph.nodes.length; ++i) {
                    for (let j = 0; j < old_graph.nodes.length; ++j) {
                      if (new_graph.nodes[i].id == old_graph.nodes[j].id) {
                        new_graph.nodes[i].x = old_graph.nodes[j].x;
                        new_graph.nodes[i].y = old_graph.nodes[j].y;
                        new_graph.nodes[i].vx = old_graph.nodes[j].vx;
                        new_graph.nodes[i].vy = old_graph.nodes[j].vy;                       
                        break;
                      }
                    }
                  }

                  Graph.graphData(new_graph);
              });              

              function nodePaint({ hover, type, x, y }, color, ctx) {

                // commit, branch, tag, stash, remote, head
                let identifier = ['C', 'B', 'T', 'S', 'R', 'H'];
                ctx.fillStyle = color;

                [
                  () => { ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI, false); ctx.fill(); }, // circle
                  () => { ctx.fillRect(x - 6, y - 6, 12, 12); ctx.fillStyle = 'white'; ctx.font = '6px Sans-Serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(identifier[type], x, y);}, // text box
                ][type == 0 ? 0 : 1]();
              }                
          </script>
          </body>`;
        }
      }
    }
  );

  let end = vscode.commands.registerCommand("git-visualizer.end", async () => {
    // The code you place here will be executed every time your command is executed

    // makes sure that only 1 workspace is open
    if (vscode.workspace.workspaceFolders == undefined) {
      vscode.window.showInformationMessage("No workspace opened!");
      return 0;
    } else if (vscode.workspace.workspaceFolders.length > 1) {
      vscode.window.showInformationMessage("More than 1 workspace opened!");
      return 0;
    }

    // get path of workspace (first workspace)
    let ws_path = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // get git graph data
    let graph_data = await get_git_graph(ws_path);

    if (!currentPanel) {
      return;
    }

    // Send a message to our webview.
    // You can send any JSON serializable data.
    currentPanel.webview.postMessage(graph_data);
  });

  context.subscriptions.push(start, end);
}

// this method is called when your extension is deactivated
export function deactivate() {}
