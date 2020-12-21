export class CmdError implements Error {
  constructor(
    public stdout:string,
    public stderr:string) {

  }
  name: string = "Command error";
  message: string = `Error on command stderr: '${this.stderr}'`;
  stack?: string;
}
