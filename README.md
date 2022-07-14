# git-visualizer README

The git visualizer is a vs code extension that visualizes git graphs to help you learn about git. The visualization style was inspired by the git-learning game [Oh My Git](https://ohmygit.org/), which I highly recommend. This extension makes use of the excellent [force-graph library](https://www.npmjs.com/package/force-graph) to produce the visualizations.

## How to use the tool

1. Install the git-visualizer
2. Open a folder that is a git repo
3. Use `cmd + shift + p` or `ctrl + shift + p` to access the command palette.
4. Select the command `Git Visualizer: Visualize Git Graph`.
5. A visualization of the repo will be displayed in vscode!

## Demo Video

This [video](https://www.youtube.com/watch?v=JCpiVWqUxvY) shows the extension in action.

## Example: git graph visualization

![](/images/git_graph.PNG)

## Legend

- Circle - Commit
- Square - Reference
  - LB - Local Branch
  - T - Tag
  - RB - Remote Branch
  - S - Stash
  - H - HEAD

## Notes

- This tool is slow on repos with more ~20 commits.
- Right clicking on nodes saves the commit hash / reference name to your clipboard.
- Hovering over nodes reveals the commit message / reference name.
- Nodes can be grabbed and moved with your cursor.

## Credits

This extension was developed by Pranav Jain.
