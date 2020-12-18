import * as vscode from 'vscode';
import * as childProcess from 'child_process'
import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, TestSuiteInfo } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { runFakeTests } from './fakeTests';

/**
 * This class is intended as a starting point for implementing a "real" TestAdapter.
 * The file `README.md` contains further instructions.
 */
export class ElixirAdapter implements TestAdapter {

  private disposables: { dispose(): void }[] = [];

  private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
  private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
  private readonly autorunEmitter = new vscode.EventEmitter<void>();

  get tests(): vscode.Event<TestLoadStartedEvent | TestLoadFinishedEvent> { return this.testsEmitter.event; }
  get testStates(): vscode.Event<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent> { return this.testStatesEmitter.event; }
  get autorun(): vscode.Event<void> | undefined { return this.autorunEmitter.event; }

  constructor(
    public readonly workspace: vscode.WorkspaceFolder,
    private readonly log: Log,
    private readonly context: vscode.ExtensionContext
  ) {
    this.log.info('Initializing elixir adapter');

    this.disposables.push(this.testsEmitter);
    this.disposables.push(this.testStatesEmitter);
    this.disposables.push(this.autorunEmitter);

  }

  async load(): Promise<void> {

    this.log.info('Loading example tests');

    this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

    const loadedTests = await this.loadElixirTests();

    this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: loadedTests });

  }

  async run(tests: string[]): Promise<void> {

    this.log.info(`Running example tests ${JSON.stringify(tests)}`);

    this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });

    // in a "real" TestAdapter this would start a test run in a child process
    await runFakeTests(tests, this.testStatesEmitter);

    this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });

  }

/*	implement this method if your TestAdapter supports debugging tests
  async debug(tests: string[]): Promise<void> {
    // start a test run in a child process and attach the debugger to it...
  }
*/

  cancel(): void {
    // in a "real" TestAdapter this would kill the child process for the current test run (if there is any)
    throw new Error("Method not implemented.");
  }

  dispose(): void {
    this.cancel();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
  async loadElixirTests() : Promise<TestSuiteInfo> {
    console.log("loading elixir tests");
    let testDatap = new Promise<TestSuiteInfo>((resolve, reject) => {
      console.log("Going into run elixir discover");
      let cmd = `elixir ${this.context.asAbsolutePath('./src/elixir_helper/discover.exs')}`;
      console.log(`command is ${cmd}`)
      const execArgs: childProcess.ExecOptions = {
        cwd: this.workspace.uri.fsPath + "/test",
        maxBuffer: 8192 * 8192
      };
      childProcess.exec(cmd, execArgs, (err, stdout) => {
        if (err) {
          this.log.error(`Error while finding ExUnit test suite: ${err.message}`);
          reject(err);
          return;
        }
        resolve(this.parse(stdout));
      });
    });
    return testDatap;
  }
  parse(jsonOutput : string) : TestSuiteInfo {
    console.log("jsonOutpu")
    let kids = JSON.parse(jsonOutput);
    console.log("post")
    let children = kids.map((child: any[]) => {
      let fname = child[0]
      return {
        type: 'suite',
        id: fname,
        label: fname,
        children: child[1].map((test: any[]) => {
          let func_line = `${test[0]}:${test[1]}`
          let id = `${fname}#${func_line}`
          return {
            type: 'test',
            id: id,
            label: func_line
          }
        }),
      };
    });
    return {
      type: 'suite',
      id: 'root',
      label: 'ExUnit',
      children: children
    } as TestSuiteInfo
  }
}
