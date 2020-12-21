defmodule HelloWorldTest do
  def hello(), do: :world
end
defmodule ElixirHelperTest do
  use ExUnit.Case

  test "greets the world" do
    assert HelloWorldTest.hello() == :world
  end
  test "below greets the world" do
    assert false
  end

  test "is another test" do
    assert true
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
