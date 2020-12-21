defmodule ElixirHelperTest do
  use ExUnit.Case

  test "greets the world" do
    assert ElixirHelper.hello() == :world
  end

  test "is another test" do
    assert false
  end
  describe "test suite" do
    test "test 1" do
      assert false
    end
    test "test 2" do
      assert true

    end

  end
end
