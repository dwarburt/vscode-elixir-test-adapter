# Elixir Test Adapter for Visual Studio Code

This repository contains a `TestAdapter` extension that works with the
[Test Explorer](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) extension.

More documentation can be found in the [Test Adapter API repository](https://github.com/hbenl/vscode-test-adapter-api).

## Setup

* Install this extension.
* Make sure elixir and mix are available on your PATH.
* Tests must live in the `test` subdirectory and file names containing tests must end with `_test.exs`
* Implemented features: Auto run tests.
* Not supported yet: Debugging, cancelling
