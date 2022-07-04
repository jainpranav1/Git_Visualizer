// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { simpleGit } from "simple-git";
import * as path from "path";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "git-visualizer" is now active!'
  );

  // Only allow a single Cat Coder
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

      // define commit interface
      interface Commit {
        hash: string;
        message: string;
        parent_hashes: Array<string>;
        refs: Array<string>;
      }

      // get all commits of repository
      let commits: Array<Commit> = [];
      {
        // get commits with 'git log --reflog'
        let log_result = await simpleGit(ws_path).log(["--reflog"]);
        let log_res_all = log_result["all"];

        for (let i = 0; i < log_res_all.length; ++i) {
          // get parent hashes
          let p_hashes = await simpleGit(ws_path).raw([
            "log",
            "--pretty=%P",
            "-n",
            "1",
            log_res_all[i]["hash"],
          ]);

          // create new commit
          let commit: Commit = {
            hash: log_res_all[i]["hash"],
            message: log_res_all[i]["message"],
            parent_hashes:
              p_hashes == "\n"
                ? []
                : p_hashes.substring(0, p_hashes.length - 1).split(" "),
            refs:
              log_res_all[i]["refs"] == ""
                ? []
                : log_res_all[i]["refs"].split(", "),
          };

          commits.push(commit);
        }
      }

      // define graph interfaces (Node, Link, Graph_Data)
      enum Node_Type {
        Commit = 0,
        Branch = 1,
        Tag = 2,
        Stash = 3,
        Remote = 4,
        Head = 5,
      }

      interface Node {
        id: string;
        hover: string;
        rt_clk: string;
        type: Node_Type;
      }

      interface Link {
        source: string;
        target: string;
      }

      interface Graph_Data {
        nodes: Array<Node>;
        links: Array<Link>;
      }

      // create graph data
      let nodes: Array<Node> = [];
      let links: Array<Link> = [];
      {
        for (let i = 0; i < commits.length; ++i) {
          // create commit node
          nodes.push({
            id: commits[i]["hash"],
            hover: commits[i]["message"],
            rt_clk: commits[i]["hash"],
            type: Node_Type.Commit,
          });

          // create commit-to-commit link
          for (let j = 0; j < commits[i]["parent_hashes"].length; ++j) {
            links.push({
              source: commits[i]["parent_hashes"][j],
              target: commits[i]["hash"],
            });
          }

          for (let k = 0; k < commits[i]["refs"].length; ++k) {
            // create head ref node and head-to-commit link
            if (commits[i]["refs"][k] == "HEAD") {
              nodes.push({
                id: "HEAD",
                hover: "HEAD",
                rt_clk: "HEAD",
                type: Node_Type.Head,
              });

              links.push({
                source: "HEAD",
                target: commits[i]["hash"],
              });
            }

            // create stash ref node and stash-to-commit link
            else if (commits[i]["refs"][k] == "refs/stash") {
              nodes.push({
                id: "stash",
                hover: "stash",
                rt_clk: "stash",
                type: Node_Type.Stash,
              });

              links.push({
                source: "stash",
                target: commits[i]["hash"],
              });
            }

            // create tag ref node and tag-to-commit link
            else if (commits[i]["refs"][k].startsWith("tag: ")) {
              let tag_name = commits[i]["refs"][k].substring(5);
              nodes.push({
                id: "tags/" + tag_name,
                hover: tag_name,
                rt_clk: tag_name,
                type: Node_Type.Tag,
              });

              links.push({
                source: "tags/" + tag_name,
                target: commits[i]["hash"],
              });
            }

            // create remote ref node and remote-to-commit link
            else if (commits[i]["refs"][k].includes("/")) {
              let remote_name = commits[i]["refs"][k];
              nodes.push({
                id: remote_name,
                hover: remote_name,
                rt_clk: remote_name,
                type: Node_Type.Remote,
              });

              links.push({
                source: remote_name,
                target: commits[i]["hash"],
              });
            }

            // create branch ref node and branch-to-commit link
            // also create head if necessary
            else {
              if (commits[i]["refs"][k].startsWith("HEAD -> ")) {
                let branch_name = commits[i]["refs"][k].substring(8);

                nodes.push({
                  id: "branch/" + branch_name,
                  hover: branch_name,
                  rt_clk: branch_name,
                  type: Node_Type.Branch,
                });

                links.push({
                  source: "branch/" + branch_name,
                  target: commits[i]["hash"],
                });

                nodes.push({
                  id: "HEAD",
                  hover: "HEAD",
                  rt_clk: "HEAD",
                  type: Node_Type.Head,
                });

                links.push({
                  source: "HEAD",
                  target: "branch/" + branch_name,
                });
              } else {
                let branch_name = commits[i]["refs"][k];

                nodes.push({
                  id: "branch/" + branch_name,
                  hover: branch_name,
                  rt_clk: branch_name,
                  type: Node_Type.Branch,
                });

                links.push({
                  source: "branch/" + branch_name,
                  target: commits[i]["hash"],
                });
              }
            }
          }
        }
      }
      let graph_data: Graph_Data = {
        nodes: nodes,
        links: links,
      };

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
                        console.log('match')
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

    // define commit interface
    interface Commit {
      hash: string;
      message: string;
      parent_hashes: Array<string>;
      refs: Array<string>;
    }

    // get all commits of repository
    let commits: Array<Commit> = [];
    {
      // get commits with 'git log --reflog'
      let log_result = await simpleGit(ws_path).log(["--reflog"]);
      let log_res_all = log_result["all"];

      for (let i = 0; i < log_res_all.length; ++i) {
        // get parent hashes
        let p_hashes = await simpleGit(ws_path).raw([
          "log",
          "--pretty=%P",
          "-n",
          "1",
          log_res_all[i]["hash"],
        ]);

        // create new commit
        let commit: Commit = {
          hash: log_res_all[i]["hash"],
          message: log_res_all[i]["message"],
          parent_hashes:
            p_hashes == "\n"
              ? []
              : p_hashes.substring(0, p_hashes.length - 1).split(" "),
          refs:
            log_res_all[i]["refs"] == ""
              ? []
              : log_res_all[i]["refs"].split(", "),
        };

        commits.push(commit);
      }
    }

    // define graph interfaces (Node, Link, Graph_Data)
    enum Node_Type {
      Commit = 0,
      Branch = 1,
      Tag = 2,
      Stash = 3,
      Remote = 4,
      Head = 5,
    }

    interface Node {
      id: string;
      hover: string;
      rt_clk: string;
      type: Node_Type;
    }

    interface Link {
      source: string;
      target: string;
    }

    interface Graph_Data {
      nodes: Array<Node>;
      links: Array<Link>;
    }

    // create graph data
    let nodes: Array<Node> = [];
    let links: Array<Link> = [];
    {
      for (let i = 0; i < commits.length; ++i) {
        // create commit node
        nodes.push({
          id: commits[i]["hash"],
          hover: commits[i]["message"],
          rt_clk: commits[i]["hash"],
          type: Node_Type.Commit,
        });

        // create commit-to-commit link
        for (let j = 0; j < commits[i]["parent_hashes"].length; ++j) {
          links.push({
            source: commits[i]["parent_hashes"][j],
            target: commits[i]["hash"],
          });
        }

        for (let k = 0; k < commits[i]["refs"].length; ++k) {
          // create head ref node and head-to-commit link
          if (commits[i]["refs"][k] == "HEAD") {
            nodes.push({
              id: "HEAD",
              hover: "HEAD",
              rt_clk: "HEAD",
              type: Node_Type.Head,
            });

            links.push({
              source: "HEAD",
              target: commits[i]["hash"],
            });
          }

          // create stash ref node and stash-to-commit link
          else if (commits[i]["refs"][k] == "refs/stash") {
            nodes.push({
              id: "stash",
              hover: "stash",
              rt_clk: "stash",
              type: Node_Type.Stash,
            });

            links.push({
              source: "stash",
              target: commits[i]["hash"],
            });
          }

          // create tag ref node and tag-to-commit link
          else if (commits[i]["refs"][k].startsWith("tag: ")) {
            let tag_name = commits[i]["refs"][k].substring(5);
            nodes.push({
              id: "tags/" + tag_name,
              hover: tag_name,
              rt_clk: tag_name,
              type: Node_Type.Tag,
            });

            links.push({
              source: "tags/" + tag_name,
              target: commits[i]["hash"],
            });
          }

          // create remote ref node and remote-to-commit link
          else if (commits[i]["refs"][k].includes("/")) {
            let remote_name = commits[i]["refs"][k];
            nodes.push({
              id: remote_name,
              hover: remote_name,
              rt_clk: remote_name,
              type: Node_Type.Remote,
            });

            links.push({
              source: remote_name,
              target: commits[i]["hash"],
            });
          }

          // create branch ref node and branch-to-commit link
          // also create head if necessary
          else {
            if (commits[i]["refs"][k].startsWith("HEAD -> ")) {
              let branch_name = commits[i]["refs"][k].substring(8);

              nodes.push({
                id: "branch/" + branch_name,
                hover: branch_name,
                rt_clk: branch_name,
                type: Node_Type.Branch,
              });

              links.push({
                source: "branch/" + branch_name,
                target: commits[i]["hash"],
              });

              nodes.push({
                id: "HEAD",
                hover: "HEAD",
                rt_clk: "HEAD",
                type: Node_Type.Head,
              });

              links.push({
                source: "HEAD",
                target: "branch/" + branch_name,
              });
            } else {
              let branch_name = commits[i]["refs"][k];

              nodes.push({
                id: "branch/" + branch_name,
                hover: branch_name,
                rt_clk: branch_name,
                type: Node_Type.Branch,
              });

              links.push({
                source: "branch/" + branch_name,
                target: commits[i]["hash"],
              });
            }
          }
        }
      }
    }
    let graph_data: Graph_Data = {
      nodes: nodes,
      links: links,
    };

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
