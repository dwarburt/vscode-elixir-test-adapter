defmodule Discover do
  def tests(args) do
    start_path = case args do
      [p] -> p
      _ -> "."
    end
    get_test_files(start_path)
    |> Enum.flat_map(&get_test_methods/1)
  end
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
  def save_test(acc, name, ln) do
    test_tuple = case acc[:describes] do
      [top | _rest] -> {"#{top} // #{name}", ln}
      [] -> {"#{name}", ln}
    end
    [describes: acc[:describes], tests: [test_tuple | acc[:tests]]]
  end
  def pop_description(acc) do
    new_describes = case acc[:describes] do
      [_ | rest] -> rest
      [] -> []
    end
    Keyword.put(acc, :describes, new_describes)
  end
  def push_description(acc, d) do
    Keyword.put(acc, :describes,
      [d | acc[:describes]]
    )
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

  def get_test_methods(file_path) do
    file_path
    |> File.read!()
    |> Code.string_to_quoted!()
    |> Macro.traverse([describes: [], tests: []], &Discover.pre_node/2, &Discover.post_node/2)
    |> case do
      {_, [describes: [], tests: []]} -> []
      {_, [describes: [], tests: tests]} -> [[file_path, tests]]
    end
  end
end
IO.inspect System.argv() |> Discover.tests()
