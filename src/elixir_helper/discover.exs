defmodule Discover do
  def tests(args) do
    start_path = case args do
      [p] -> p
      _ -> "."
    end
    all_children = get_test_files(start_path)
    |> Enum.flat_map(&get_test_methods/1)

    new_suite("root", all_children)
  end
  def new_suite(file_path, children \\ []), do: %{type: "suite", id: file_path, label: file_path, children: children}

  def get_test_files(path) do
    all = File.ls!(path)
    |> Enum.map(&Path.join(path, &1))

    tests = all
    |> Enum.filter(&String.ends_with?(&1, "_test.exs"))

    subs = all
    |> Enum.filter(&File.dir?/1)
    |> Enum.flat_map(fn (next_path) ->
      get_test_files(next_path)
    end)

    tests ++ subs
  end
  def get_test_methods(file_path) do
    file_path
    |> File.read!()
    |> Code.string_to_quoted!()
    |> Macro.traverse([new_suite(file_path)], &Discover.pre_node/2, &Discover.post_node/2)
    |> case do
      {_, [%{children: []}]} -> []
      {_, [suite]} -> [suite]
    end
  end

  def save_test(acc, name, ln) do
    test_path = Enum.map(acc, &Map.fetch!(&1, :id)) |> Enum.reverse() |> Enum.join("/")
    test = %{type: "test", id: "#{test_path}:#{ln}", label: name}
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

  def push_description(acc, d) do
    [new_suite(d) | acc]
  end


  def pre_node(node = {:test, [line: ln], [test_name | _ast]}, acc) do
    {node, acc|>save_test(test_name, ln)}
  end
  def pre_node(node = {:describe, [line: _ln], [ description | _ast]}, acc) do
    {node, acc|>push_description(description)}
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
results =
  System.argv()
  |> Discover.tests()
Kernel.inspect(results, limit: :infinity) |> String.replace("%", "") |> IO.puts()
