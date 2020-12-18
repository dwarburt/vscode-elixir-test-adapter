defmodule ElixirHelperTest do
  use ExUnit.Case
  doctest ElixirHelper

  test "greets the world" do
    assert ElixirHelper.hello() == :world
  end
end
