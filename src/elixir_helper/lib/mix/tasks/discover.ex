defmodule Mix.Tasks.Discover do
  use Mix.Task
  @shortdoc "finds unit tests"
  def run(args) do
    start_path = case args do
      [p] -> p
      _ -> raise ("Needs the path.")
    end
    :ok = File.cd(start_path)

    all_children =
      get_test_suites("test")

    #new_suite("root", "root", all_children)
    all_children
    |> Jason.encode!()
    #|> Io.inspect()
    |> IO.puts()

  end

  def get_test_suites(path) do
    all = File.ls!(path)

    subs = all
    |> Enum.filter(&File.dir?(Path.join(path, &1)))
    |> Enum.map(fn (next_path) ->
      get_test_suites(Path.join(path, next_path))
    end)
    |> Enum.reject(fn suite -> Enum.empty?(suite.children) end)

    tests = all
    |> Enum.filter(&String.ends_with?(&1, "_test.exs"))
    |> Enum.flat_map(fn p -> get_test_methods(Path.join(path, p), p) end)

    new_suite(path, path, subs ++ tests)
  end
  def get_test_methods(full_path, suite_name) do
    full_path
    |> File.read!()
    |> Code.string_to_quoted!()
    |> Macro.traverse([new_suite(full_path, suite_name)], &pre_node/2, &post_node/2)
    |> case do
      {_, [%{children: []}]} -> []
      {_, [suite]} -> [suite]
    end
  end

  def save_test(acc, name, ln) do
    fname = acc |> Enum.reverse() |> Enum.at(0) |> Map.get(:id)
    test = %{type: "test", id: "#{fname}:#{ln}", file: fname, line: ln-1, label: name}
    [head_suite | rest] = acc
    new_head_suite =
      head_suite
      |> Map.put(:children, [test | head_suite.children])
    [new_head_suite | rest]
  end

  def pop_description([dsuite | acc]) do
    [parent | rest] = acc
    parent = Map.put(parent, :children, [dsuite | parent.children])
    [parent | rest]
  end

  def push_description(acc, d, ln) do
    suite_path = acc |> Enum.reverse() |> Enum.at(0) |> Map.get(:id)
    [new_suite("#{suite_path}:#{ln}", d) | acc]
  end
  def new_suite(suite_path, suite_name, children \\ []) do
    my_label = if String.ends_with?(suite_name, "_test.exs") || String.starts_with?(suite_name, "/") do
      [my_label] = Path.split(suite_name) |> Enum.reverse() |> Enum.take(1) |> Enum.map(fn x -> String.replace(x, "_test.exs", "") end)
      my_label
    else
      suite_name
    end
    case String.split(suite_path, ":") do
      [file, line] -> %{type: "suite", id: "#{suite_path}", label: my_label, file: file, line: (Integer.parse(line)|>elem(0))-1, children: children}
      _ -> %{type: "suite", id: "#{suite_path}", label: my_label, children: children}
    end
  end

  def pre_node(node = {:test, [line: ln], [test_name | _ast]}, acc) do
    {node, acc|>save_test(test_name, ln)}
  end
  def pre_node(node = {:describe, [line: ln], [ description | _ast]}, acc) do
    {node, acc|>push_description(description, ln)}
  end
  def pre_node(node, acc) do
    {node, acc}
  end
  def post_node(node = {:describe, [line: _ln], [ _description | _ast]}, acc) do
    {node, acc|>pop_description()}
  end
  def post_node(node, acc) do
    {node, acc}
  end
end
