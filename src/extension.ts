// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { simpleGit } from "simple-git";
import * as path from "path";
import { get_git_graph, Graph_Data } from "./helper_functions";
var elementResizeDetectorMaker = require("element-resize-detector");


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Only allow a single webview
  let currentPanel: vscode.WebviewPanel | undefined = undefined;

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let visualize = vscode.commands.registerCommand(
    "git-visualizer.visualize",
    async () => {
      // The code you place here will be executed every time your command is executed

      // makes sure that only 1 workspace is open
      if (vscode.workspace.workspaceFolders == undefined) {
        vscode.window.showInformationMessage(
          "No workspace opened! Please open only 1 workspace."
        );
        return 0;
      } else if (vscode.workspace.workspaceFolders.length > 1) {
        vscode.window.showInformationMessage(
          "More than 1 workspace opened! Please open only 1 workspace."
        );
        return 0;
      }

      // check if .git folder exists
      try {
        await vscode.workspace.fs.stat(
          vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, ".git")
        );
      } catch {
        vscode.window.showInformationMessage(
          "Workspace is not a git repository! Please run 'git init' in the terminal."
        );
        return 0;
      }

      // get path of workspace (first workspace)
      let ws_path = vscode.workspace.workspaceFolders[0].uri.fsPath;

      // get git graph data
      let graph_data = await get_git_graph(ws_path);

      // Create and show a new webview
      if (currentPanel) {
        currentPanel.webview.postMessage(graph_data);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          "git_graph", // Identifies the type of the webview. Used internally
          "Git Graph", // Title of the panel displayed to the user
          vscode.ViewColumn.One, // Editor column to show the new webview panel in.
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          } // Webview options. More on these later.
        );

        // Get path to resource on disk
        // And get the special URI to use with the webview
        const force_graph_js = currentPanel.webview.asWebviewUri(vscode.Uri.file(
          path.join(
            context.extensionPath,
            "node_modules",
            "force-graph",
            "dist",
            "force-graph.js"
          )
        ));

        const resize_js = currentPanel.webview.asWebviewUri(vscode.Uri.file(
          path.join(
            context.extensionPath,
            "node_modules",
            "element-resize-detector",
            "dist",
            "element-resize-detector.js"
          )
        ));

        // And set its HTML content
        currentPanel.webview.html = getWebviewContent(
          force_graph_js,
          resize_js,
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
          resize_js: vscode.Uri,
          graph_data: Graph_Data
        ) {
          return `<head>
          <style>
            html, body {
              height: 100%;
              width: 100%;
            }
          </style>

          <script src="${force_graph_js}"></script>
          <script src="${resize_js}"></script>

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
                let identifier = ['C', 'LB', 'T', 'S', 'RB', 'H'];
                ctx.fillStyle = color;

                [
                  () => { ctx.beginPath(); ctx.arc(x, y, 5, 0, 2 * Math.PI, false); ctx.fill(); }, // circle
                  () => { ctx.fillRect(x - 6, y - 6, 12, 12); ctx.fillStyle = 'white'; ctx.font = '6px Sans-Serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(identifier[type], x, y);}, // text box
                ][type == 0 ? 0 : 1]();
              }
              
              elementResizeDetectorMaker().listenTo(
                document.body,
                (el) => {
                  Graph.width(el.offsetWidth);
                  Graph.height(el.offsetHeight);
                }
              );
          </script>
          </body>`;
        }
      }
    }
  );

  context.subscriptions.push(visualize);
}

// this method is called when your extension is deactivated
export function deactivate() {}
