import { simpleGit } from "simple-git";

// define commit interface
export interface Commit {
  hash: string;
  message: string;
  parent_hashes: Array<string>;
  refs: Array<string>;
}

// define graph interfaces (Node, Link, Graph_Data)
export enum Node_Type {
  Commit = 0,
  Branch = 1,
  Tag = 2,
  Stash = 3,
  Remote = 4,
  Head = 5,
}

export interface Node {
  id: string;
  hover: string;
  rt_clk: string;
  type: Node_Type;
}

export interface Link {
  source: string;
  target: string;
}

export interface Graph_Data {
  nodes: Array<Node>;
  links: Array<Link>;
}

export async function get_git_graph(ws_path: string) {
  // get all commits of repository
  let commits: Array<Commit> = [];
  {
    let log_res_all;
    try {
      // get commits with 'git log --reflog'
      let log_result = await simpleGit(ws_path).log(["--reflog"]);
      log_res_all = log_result["all"];
    } catch {
      log_res_all = [];
    }

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

  return graph_data;
}
