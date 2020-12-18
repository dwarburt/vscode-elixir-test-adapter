defmodule VscodeElixirTestExplorer.MixProject do
  use Mix.Project
  def project do
    [
      app: :vscode_elixir_test_explorer,
      version: "0.0.1",
      elixir: "~> 1.11",
      elixirc_paths: ["src/vscode_ex_helper"],
      compilers: Mix.compilers(),
      start_permanent: false,
      aliases: [],
      deps: []
    ]
  end
  def application, do: [
    mod: {:none, []},
    extra_applications: []
  ]

end
