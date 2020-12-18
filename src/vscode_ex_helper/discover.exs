defmodule Discover do
  def tests(_args) do
    start_path = "/home/david/git/rubbersoft/armiger"
    get_test_files(start_path)
    |> Enum.flat_map(&get_test_methods/1)
  end
  def get_test_files(path) do
    all = File.ls!(path)
    |> Enum.map(&Path.join(path, &1))
    tests = all |> Enum.filter(&String.ends_with?(&1, "_test.exs"))
    subs = all
    |> Enum.filter(&File.dir?/1)
    |> Enum.flat_map(fn (next_path) ->
      get_test_files(next_path)
    end)
    tests ++ subs
  end
  def get_test_methods(file_path) do

  end

end
IO.inspect System.argv() |> Discover.tests()
