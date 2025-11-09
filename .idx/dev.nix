{ pkgs, ... }:
{
  # Which nixpkgs channel to use.
  channel = "stable-24.05"; # or "unstable"

  # Packages to make available in the environment.
  packages = [ pkgs.supabase-cli pkgs.python3 ];

  # Environment variables to set in the development environment.
  # env = {
  #   API_KEY = "your-secret-key";
  # };

  # VS Code extensions to install in the editor.
  # idx.extensions = [
  #   "vscodevim.vim"
  # ];

  # Workspace lifecycle hooks.
  # idx.workspace = {
  #   # Runs when a workspace is first created.
  #   onCreate = {
  #     npm-install = "npm install";
  #   };
  #   # Runs every time the workspace is (re)started.
  #   onStart = {
  #     start-server = "npm run dev";
  #   };
  # };

  # Web-based previews.
  idx.previews = {
    enable = true;
    previews = {
      web = {
        command = ["python3" "-m" "http.server" "$PORT"];
        manager = "web";
      };
    };
  };
}