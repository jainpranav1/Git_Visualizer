# git-visualizer README

The git visualizer is a vs code extension that generates beautiful, interactive visualizations of your git graphs. The visualization style was inspired by the git-learning game [Oh My Git](https://ohmygit.org/), which I highly recommend. This extension is intended to serve as a playground to learn more about how git works.

## How to use the tool

1. Install the git-visualizer
2. Open a folder that is a git repo
3. Use `cmd + shift + p` or `ctrl + shift + p` to access the command palette.
4. Select the command `Git Visualizer: Visualize Git Graph`.
5. A visualization of the repo will be displayed in vscode!

## Example: git graph visualization

![](/images/git_graph.PNG)

## Legend

- Circle - Commit
- Square - Reference
  - B - Branch
  - T - Tag
  - R - Remote
  - S - Stash

## Notes

- This tool is slow on repos with more ~20 commits.

## Credits

This extension was developed by Pranav Jain.
