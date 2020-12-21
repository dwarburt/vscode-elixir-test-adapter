import * as vscode from 'vscode';
import * as childProcess from 'child_process'
import { TestAdapter, TestLoadStartedEvent, TestLoadFinishedEvent, TestRunStartedEvent, TestRunFinishedEvent, TestSuiteEvent, TestEvent, TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { CmdError } from './cmdError'

/**
 * This class is intended as a starting point for implementing a "real" TestAdapter.
 * The file `README.md` contains further instructions.
 */
export class ElixirAdapter implements TestAdapter {

  private disposables: { dispose(): void }[] = [];

  private readonly testsEmitter = new vscode.EventEmitter<TestLoadStartedEvent | TestLoadFinishedEvent>();
  private readonly testStatesEmitter = new vscode.EventEmitter<TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent>();
  private readonly autorunEmitter = new vscode.EventEmitter<void>();
  private rootTestSuite? : TestSuiteInfo;

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

    this.log.info('Loading elixir tests');

    this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

    this.rootTestSuite = await this.loadElixirTests();

    this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: this.rootTestSuite });

  }
  private get_test_entry(start:TestSuiteInfo, test_id : String) : TestInfo|TestSuiteInfo|undefined {
    if (start.id == test_id) {
      return start;
    }
    let found : TestSuiteInfo|TestInfo|undefined = undefined;
    for (let t of start.children) {
      if (t.type == 'suite') {
        found = this.get_test_entry(t, test_id);
        if (found != null) {
          return found;
        }
      }
      else if (t.id == test_id) {
        return t;
      }
    }
    return undefined;
  }
  private get_nested_tests(suite:TestSuiteInfo):String[] {
    let ret : String[] = [];
    for (let child of suite.children) {
      if (child.type == "test") {
        ret.push(child.id);
      } else {
        ret.concat(this.get_nested_tests(child));
      }
    }
    return ret;
  }
  async run(tests: string[]): Promise<void> {

    this.log.info(`Running elixir test cases ${JSON.stringify(tests)}`);

    this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests });
    let test_promises = tests.map(async (test):Promise<string> => {
      let nested_tests_ids:String[] = [test];
      if (this.rootTestSuite) {
        let ti = this.get_test_entry(this.rootTestSuite, test);
        if (ti && ti.type == "suite") {
          nested_tests_ids = this.get_nested_tests(ti);
        }
      }
      if (nested_tests_ids) {
        nested_tests_ids.forEach(id => {
          this.testStatesEmitter.fire(<TestEvent>{
            test: id,
            state: 'running'
          });
        })
      }
      try {
        let results = await this.do_ws_cmd(`mix test ${test}`);
        this.testStatesEmitter.fire(<TestEvent>{
          test: test,
          state: 'passed'
        });
        return results;
      }
      catch(err) {
        this.log.error(`test errored out ${err.stdout}`)
        let error_log:string = err.stdout;
        let failure_count = 1;
        let fail_msg = "";
        let fail_test_id = ""
        error_log.split("\n").forEach((line) => {
          if (line.startsWith(`  ${failure_count})`)) {
            fail_msg += line + "\n";
          }
          else if (line.length == 0 && fail_msg != "") {
            this.testStatesEmitter.fire(<TestEvent>{
              test: fail_test_id,
              state: 'errored',
              message: fail_msg
            });
            fail_msg = "";
            failure_count += 1;
            nested_tests_ids = nested_tests_ids.filter(i => i != fail_test_id)
          }
          else if (nested_tests_ids.includes(line.trim())) {
            fail_test_id = line.trim();
          }
          else if (fail_msg != "") {
            fail_msg += line + "\n";
          }
        });
        if (nested_tests_ids) {
          nested_tests_ids.forEach(id => {
            this.testStatesEmitter.fire(<TestEvent>{
              test: id,
              state: "passed"
            });
          });
        }

        return err;
      }
    });

    await Promise.all(test_promises);
    this.log.info("tests finished");


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
  private async do_cmd(cmd : string, wd: string) : Promise<string> {
    const execArgs: childProcess.ExecOptions = {
      cwd: wd,
      maxBuffer: 8192 * 8192
    };
    return new Promise<string>((resolve, reject) => {
      childProcess.exec(cmd, execArgs, (err, stdout, stderr) => {
        if (err) {
          reject(new CmdError(stdout, stderr));
        } else {
          resolve(stdout);
        }
      });
    });
  }
  private async do_helper_cmd(cmd:string):Promise<string> {
    return await this.do_cmd(cmd, this.context.asAbsolutePath("./src/elixir_helper"));
  }
  private async do_ws_cmd(cmd:string):Promise<string> {
    return await this.do_cmd(cmd, this.workspace.uri.fsPath);
  }
  private async loadElixirTests() : Promise<TestSuiteInfo> {
    await this.do_helper_cmd(`mix do deps.get, compile`);
    let helper_output = await this.do_helper_cmd(`mix discover ${this.workspace.uri.fsPath}`);
    return JSON.parse(helper_output) as TestSuiteInfo;
  }
}
